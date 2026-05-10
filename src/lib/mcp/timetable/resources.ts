import type { Leg, SearchResult, TransferAssessment } from "@/lib/sbb";

import {
  extractRelativeDayOffset,
  resolveRelativeDateIso,
} from "@/lib/date-utils";
import type { McpLanguage } from "../types";

const TIMETABLE_ROUTE_PATTERNS = [
  /\b(?:nach|to|à|vers)\s+(.+?)\s*\(\s*(?:von|from|ab|de|depuis)\s+(.+?)\s*\)(?=[?.!,]|$)/i,
  /\b(?:von|from|ab|de|depuis)\s+(.+?)\s*\(\s*(?:nach|to|à|vers|bis)\s+(.+?)\s*\)(?=[?.!,]|$)/i,
  /\b(?:von|from|ab|de|depuis)\s+(.+?)\s+(?:nach|to|à|vers|bis)\s+(.+?)(?=[?.!,]|$)/i,
  /\b([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+)*)\s+(?:nach|to|à|vers|bis)\s+([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+)*)(?=[?.!,]|$)/i,
  /\b(?:nach|to|à|vers)\s+(.+?)(?=[?.!,]|$)/i,
  /\b(?:von|from|ab|de|depuis)\s+(.+?)(?=[?.!,]|$)/i,
];

const TIMETABLE_TIME_PATTERNS = [
  /\b(?:um|at)\s+(\d{1,2})(?::(\d{2})|(?:\.(\d{2})))?\b/i,
  /\b(\d{1,2}):(\d{2})\b/,
  /\b(\d{1,2})\.(\d{2})\b/,
  /\b(\d{1,2})\s*uhr\b/i,
  /\b(\d{1,2})\s*o[' ]?clock\b/i,
];

const TIMETABLE_RELATIVE_TIME_PATTERNS = [
  /\b(?:ab|nach|after|from|seit)\s+(\d{1,2})(?::(\d{2})|(?:\.(\d{2})))?\b/i,
];

const TIMETABLE_DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
  /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/,
  /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/,
];

const TIMETABLE_TIME_NOISE_PATTERNS = [
  /\b(?:um|at)\s+\d{1,2}(?::\d{2}|\.\d{2})?\b/gi,
  /\b(?:jetzt|now|maintenant|heute|today|aujourd'hui|morgen|tomorrow|demain|übermorgen|uebermorgen|in\s+\d+\s+tag(?:e|en)?|in\s+\d+\s+days?)\b/gi,
  /\b(?:in|für|fur)\s+(?:\d+|einem?|einer?|ein|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn)\s+(?:tag(?:e|en)?|days?)\b/gi,
];

const TIMETABLE_REQUEST_TAIL_PATTERNS = [
  /\bbitte\s+(?:such|suche|finde|prüfe|pruefe|check)\s+(?:den\s+)?(?:fahrplan|verbindung(?:en)?|timetable|schedule)\b.*$/i,
];

const TIMETABLE_KEYWORDS = [
  /\b(fahrplan|verbindung|verbindungen|zug|züge|abfahrt|ankunft|hinfahrt|rückfahrt|nach fahrplan)\b/i,
  /\b(timetable|schedule|train|departure|arrival)\b/i,
  /\b(horaire|train|départ|arrivée|correspondance)\b/i,
];

function normalizeTimetableText(message: string): string {
  let value = message.trim();

  for (const pattern of TIMETABLE_TIME_NOISE_PATTERNS) {
    value = value.replace(pattern, " ");
  }

  for (const pattern of TIMETABLE_REQUEST_TAIL_PATTERNS) {
    value = value.replace(pattern, " ");
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeStationValue(value: string): string {
  return value
    .replace(/\(\s*(?:von|from|ab|de|depuis)\s+.+?\s*\)/gi, "")
    .replace(/\(\s*(?:nach|to|à|vers|bis)\s+.+?\s*\)/gi, "")
    .replace(/[?.!,]+$/g, "")
    .replace(/\b(?:um|am|heute|today|tomorrow|demain|uhr|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sunday|monday|tuesday|wednesday|thursday|friday|saturday|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|suchen|suche|such|finde|check)\b.*$/gi, "")
    .replace(/\b(?:bitte|please|bitte\s+um|bitte\s+die)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRouteFromText(message: string): { from?: string; to?: string } {
  const cleaned = normalizeTimetableText(message);

  for (const pattern of TIMETABLE_ROUTE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (!match) continue;

    if (match[2]) {
      return {
        from: normalizeStationValue(match[1] ?? ""),
        to: normalizeStationValue(match[2] ?? ""),
      };
    }

    if (match[1]) {
      const to = normalizeStationValue(match[1]);
      const parentheticalFrom = match[1].match(/\(\s*(?:von|from|ab|de|depuis)\s+(.+?)\s*\)/i)?.[1];
      if (parentheticalFrom) {
        return {
          from: normalizeStationValue(parentheticalFrom),
          to,
        };
      }

      return { to };
    }
  }

  return {};
}

function extractExplicitDate(message: string): string | null {
  if (/\b(?:jetzt|now|maintenant)\b/i.test(message)) {
    return resolveRelativeDateIso(0);
  }

  const relativeOffset = extractRelativeDayOffset(message);
  if (relativeOffset !== null) {
    return resolveRelativeDateIso(relativeOffset);
  }

  for (const pattern of TIMETABLE_DATE_PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;

    if (pattern.source.includes("\\d{4}")) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    if (pattern.source.includes("\\.")) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }

    if (pattern.source.includes("/")) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function extractExplicitTime(message: string): string | null {
  for (const pattern of TIMETABLE_TIME_PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;

    if (pattern.source.includes(":")) {
      const hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    } else if (pattern.source.includes("\\.")) {
      const hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    } else {
      const hours = Number.parseInt(match[1], 10);
      if (hours >= 0 && hours < 24) {
        return `${String(hours).padStart(2, "0")}:00`;
      }
    }
  }

  for (const pattern of TIMETABLE_RELATIVE_TIME_PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2] ?? match[3] ?? "0", 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractLooseTime(message: string): string | null {
  const loosePatterns = [
    /\b(?:um|ab|nach|gegen|around|at)\s+(\d{1,2})(?::(\d{2})|(?:\.(\d{2})))?\b/i,
    /\b(\d{1,2})\s*(?:uhr|hrs?|h)\b/i,
  ];

  for (const pattern of loosePatterns) {
    const match = message.match(pattern);
    if (!match) continue;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2] ?? match[3] ?? "0", 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractArrivalMode(message: string): boolean {
  return /\b(ankunft|ankommen|ankomm|bis|arrive|arrival|before|vor|spätestens|spaetestens)\b/i.test(message);
}

function formatDurationMinutes(duration: string): number | null {
  const compact = duration.trim();

  const isoMatch = compact.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? "0", 10);
    const minutes = Number.parseInt(isoMatch[2] ?? "0", 10);
    return hours * 60 + minutes;
  }

  const humanMatch = compact.match(/(?:(\d+)\s*h)?(?:\s*(\d+)\s*m)?/i);
  if (!humanMatch) {
    return null;
  }

  const hours = Number.parseInt(humanMatch[1] ?? "0", 10);
  const minutes = Number.parseInt(humanMatch[2] ?? "0", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseClockMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function scoreTimetableConnection(connection: SearchResult["connections"][number], requestedMinutes: number | null): number {
  const departureMinutes = parseClockMinutes(connection.departure);
  const durationMinutes = formatDurationMinutes(connection.duration);
  const departurePenalty = requestedMinutes !== null && departureMinutes !== null
    ? departureMinutes >= requestedMinutes
      ? departureMinutes - requestedMinutes
      : 1440 + departureMinutes - requestedMinutes
    : 0;

  return departurePenalty * 100000 + connection.changes * 1000 + (durationMinutes ?? 9999);
}

function formatTransferTone(language: McpLanguage, tone: "tight" | "okay" | "plenty" | "unknown"): string {
  if (language === "fr") {
    switch (tone) {
      case "tight":
        return "serré";
      case "okay":
        return "correct";
      case "plenty":
        return "confortable";
      default:
        return "inconnu";
    }
  }

  switch (tone) {
    case "tight":
      return "knapp";
    case "okay":
      return "ok";
    case "plenty":
      return "komfortabel";
    default:
      return "unbekannt";
  }
}

function formatDurationLabel(language: McpLanguage, duration: string): string {
  const compact = duration.trim();
  const match = compact.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i);
  if (!match) {
    return duration;
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);

  if (language === "fr") {
    const parts = [
      hours > 0 ? `${hours} h` : null,
      minutes > 0 ? `${minutes} min` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : duration;
  }

  const parts = [
    hours > 0 ? `${hours} Std.` : null,
    minutes > 0 ? `${minutes} Min.` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : duration;
}

function formatPlatformLabel(language: McpLanguage, platform?: string | null): string | null {
  if (!platform) {
    return null;
  }

  return language === "fr" ? `quai ${platform}` : `Gleis ${platform}`;
}

function formatSectionTimeLabel(language: McpLanguage, label: "departure" | "arrival"): string {
  if (language === "fr") {
    return label === "departure" ? "Départ" : "Arrivée";
  }

  return label === "departure" ? "Abfahrt" : "Ankunft";
}

function formatStationLine(
  language: McpLanguage,
  station: string,
  time: string,
  platform?: string | null,
  direction?: string | null,
  label: "departure" | "arrival" = "departure"
): string {
  const parts = [
    `${formatSectionTimeLabel(language, label)}: ${station} ${time}`,
    platform ? formatPlatformLabel(language, platform) : null,
    direction ? (language === "fr" ? `Direction ${direction}` : `Richtung ${direction}`) : null,
  ].filter(Boolean);

  return parts.join(", ");
}

function formatTransferSummary(
  language: McpLanguage,
  assessment: TransferAssessment,
  includeDistance = false
): string {
  const given = assessment.givenMinutes === null ? null : `${assessment.givenMinutes} ${language === "fr" ? "min" : "Min."}`;
  const required = assessment.requiredMinutes === null ? null : `${assessment.requiredMinutes} ${language === "fr" ? "min" : "Min."}`;
  const slack = assessment.slackMinutes === null ? null : `${assessment.slackMinutes >= 0 ? "+" : ""}${assessment.slackMinutes} ${language === "fr" ? "min" : "Min."}`;
  const walk = assessment.walkMinutes === null ? null : `${assessment.walkMinutes} ${language === "fr" ? "min à pied" : "Min. Fußweg"}`;
  const tone = formatTransferTone(language, assessment.tone);
  const distance = includeDistance && typeof assessment.walkDistanceMeters === "number"
    ? assessment.walkDistanceMeters >= 1000
      ? `${(assessment.walkDistanceMeters / 1000).toFixed(assessment.walkDistanceMeters >= 5000 ? 0 : 1)} km`
      : `${Math.round(assessment.walkDistanceMeters)} m`
    : null;

  if (language === "fr") {
    return [
      given ? `correspondance ${given}` : null,
      required ? `nécessaire ${required}` : null,
      slack ? `marge ${slack}` : null,
      walk ? `marche ${walk}` : null,
      distance ? `distance ${distance}` : null,
      tone ? `évaluation ${tone}` : null,
    ].filter(Boolean).join(", ");
  }

  return [
    given ? `Umstiegszeit ${given}` : null,
    required ? `benötigt ${required}` : null,
    slack ? `Puffer ${slack}` : null,
    walk ? `Fußweg ${walk}` : null,
    distance ? `Distanz ${distance}` : null,
    tone ? `Einschätzung ${tone}` : null,
  ].filter(Boolean).join(", ");
}

function formatMarkdownPlatformLabel(language: McpLanguage, platform?: string | null): string | null {
  const label = formatPlatformLabel(language, platform);
  return label || null;
}

function formatMarkdownTransferSummary(
  assessment: TransferAssessment,
  language: McpLanguage
): string {
  const given = assessment.givenMinutes === null ? null : `${assessment.givenMinutes} ${language === "fr" ? "min" : "Min."}`;
  const required = assessment.requiredMinutes === null ? null : `${assessment.requiredMinutes} ${language === "fr" ? "min" : "Min."}`;
  const slack = assessment.slackMinutes === null ? null : `${assessment.slackMinutes >= 0 ? "+" : ""}${assessment.slackMinutes} ${language === "fr" ? "min" : "Min."}`;
  const walk = assessment.walkMinutes === null ? null : `${assessment.walkMinutes} ${language === "fr" ? "min à pied" : "Min. Fußweg"}`;
  const tone = formatTransferTone(language, assessment.tone);
  const toneLabel = tone ? `*${tone}*` : null;

  const parts = [
    given ? `${language === "fr" ? "Correspondance" : "Umstiegszeit"} ${given}` : null,
    required ? `${language === "fr" ? "Nécessaire" : "Benötigt"} ${required}` : null,
    slack ? `${language === "fr" ? "Marge" : "Puffer"} ${slack}` : null,
    walk ? `${language === "fr" ? "Marche" : "Fußweg"} ${walk}` : null,
    toneLabel ? `${language === "fr" ? "Évaluation" : "Einschätzung"} ${toneLabel}` : null,
  ].filter(Boolean);

  return parts.join(", ");
}

function formatMarkdownStationLine(
  language: McpLanguage,
  label: "departure" | "arrival",
  station: string,
  time: string,
  platform?: string | null,
  direction?: string | null
): string {
  const platformCode = formatMarkdownPlatformLabel(language, platform);
  const directionLabel = direction ? ` *${language === "fr" ? "Direction" : "Richtung"} ${direction}*` : "";
  const heading = label === "departure"
    ? (language === "fr" ? "Départ" : "Abfahrt")
    : (language === "fr" ? "Arrivée" : "Ankunft");
  const betweenLabel = language === "fr" ? "à" : "um";
  const platformJoin = language === "fr" ? " sur " : " auf ";

  return `- **${heading}:** ${station} ${betweenLabel} ${time}${platformCode ? `${platformJoin}${platformCode}` : ""}${directionLabel}`;
}

function formatMarkdownLegSection(language: McpLanguage, leg: Leg): string[] {
  const departureTime = leg.departurePrognosisTime || leg.departureTime;
  const arrivalTime = leg.arrivalPrognosisTime || leg.arrivalTime;
  const heading = leg.category?.trim() || leg.number !== "–"
    ? `${leg.category?.trim() || ""} ${leg.number || ""}`.trim()
    : (language === "fr" ? "Section" : "Abschnitt");

  return [
    `### ${heading}`,
    formatMarkdownStationLine(language, "departure", leg.departureStation, departureTime, leg.departurePlatform ?? null, leg.direction),
    formatMarkdownStationLine(language, "arrival", leg.arrivalStation, arrivalTime, leg.arrivalPlatform ?? null, leg.direction),
  ];
}

function formatMarkdownTransferSection(
  language: McpLanguage,
  currentLeg: Leg,
  nextLeg: Leg,
  assessment: TransferAssessment
): string[] {
  const nextDeparturePlatform = formatMarkdownPlatformLabel(language, nextLeg.departurePlatform);
  const currentArrivalPlatform = formatMarkdownPlatformLabel(language, currentLeg.arrivalPlatform);
  const placeLabel = language === "fr" ? "Lieu" : "Ort";
  const fromLabel = language === "fr" ? "Depuis" : "Von";
  const toLabel = language === "fr" ? "Vers" : "Nach";
  const timeLabel = language === "fr" ? "Temps" : "Zeit";

  return [
    language === "fr" ? "#### Correspondance" : "#### Umstieg",
    `- **${placeLabel}:** ${currentLeg.arrivalStation}`,
    `- **${fromLabel}:** ${currentLeg.arrivalTime}${currentArrivalPlatform ? ` auf ${currentArrivalPlatform}` : ""}`,
    `- **${toLabel}:** ${nextLeg.departureTime}${nextDeparturePlatform ? ` auf ${nextDeparturePlatform}` : ""}`,
    `- **${timeLabel}:** ${formatMarkdownTransferSummary(assessment, language)}`,
  ];
}

function formatMarkdownEndpointAssessment(
  language: McpLanguage,
  label: "start" | "end",
  assessment: TransferAssessment
): string[] {
  const heading = label === "start"
    ? (language === "fr" ? "#### Accès au départ" : "#### Zugang am Start")
    : (language === "fr" ? "#### Accès à destination" : "#### Zugang am Ziel");

  return [
    heading,
    `- **${language === "fr" ? "Zeit" : "Zeit"}:** ${formatMarkdownTransferSummary(assessment, language)}`,
  ];
}

export function shouldUseTimetableTool(message: string): boolean {
  return TIMETABLE_KEYWORDS.some((pattern) => pattern.test(message));
}

export function extractTimetableContext(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }> = []
): {
  from?: string;
  to?: string;
  date?: string | null;
  time?: string | null;
  isArrival: boolean;
  missing: string[];
} {
  const fromCurrent = extractRouteFromText(message);
  let from = fromCurrent.from;
  let to = fromCurrent.to;

  if (!from || !to) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (entry.role !== "user") continue;
      const previous = extractRouteFromText(entry.text);
      if (!from && previous.from) from = previous.from;
      if (!to && previous.to) to = previous.to;
      if (from && to) break;
    }
  }

  let date = extractExplicitDate(message);
  if (!date) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (entry.role !== "user") continue;
      date = extractExplicitDate(entry.text);
      if (date) break;
    }
  }

  let time = extractExplicitTime(message) ?? extractLooseTime(message);

  if (!time) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (entry.role !== "user") continue;
      time = extractExplicitTime(entry.text) ?? extractLooseTime(entry.text);
      if (time) break;
    }
  }

  const isArrival = extractArrivalMode(message);

  const missing: string[] = [];
  if (!from) missing.push("start");
  if (!to) missing.push("ziel");
  if (!date) missing.push("datum");
  if (!time) missing.push("uhrzeit");

  return { from, to, date, time, isArrival, missing };
}

export function buildTimetableClarification(language: McpLanguage, missing: string[]): string {
  const copy = language === "fr"
    ? {
        missing: "Il me manque encore",
        askRoute: "D'où à où veux-tu aller ?",
      }
    : {
        missing: "Ich brauche noch",
        askRoute: "Von wo nach wo möchtest du fahren?",
      };

  if (missing.length === 0) {
    return "";
  }

  if (missing.includes("start") && missing.includes("ziel") && missing.length === 2) {
    return copy.askRoute;
  }

  const labels = missing.map((item) => {
    if (item === "start") return language === "fr" ? "le départ" : "den Start";
    if (item === "ziel") return language === "fr" ? "la destination" : "das Ziel";
    if (item === "datum") return language === "fr" ? "la date" : "das Datum";
    if (item === "uhrzeit") return language === "fr" ? "l'heure" : "die Uhrzeit";
    return item;
  });

  return `${copy.missing} ${labels.join(language === "fr" ? ", " : ", ")}.`;
}

export function pickBestTimetableConnection(result: SearchResult, request: { time: string }) {
  const requestedMinutes = parseClockMinutes(request.time);
  const connections = Array.isArray(result.connections) ? result.connections : [];

  if (connections.length === 0) {
    return null;
  }

  return connections.reduce((best, current) => {
    if (!best) return current;
    const bestScore = scoreTimetableConnection(best, requestedMinutes);
    const currentScore = scoreTimetableConnection(current, requestedMinutes);
    return currentScore < bestScore ? current : best;
  }, null as SearchResult["connections"][number] | null);
}

export function buildTimetableRequestSummary(
  input: { from: string; to: string; date: string; time: string },
  language: McpLanguage
): string {
  return language === "fr"
    ? `Départ: ${input.from}, arrivée: ${input.to}, date: ${input.date}, heure: ${input.time}`
    : `Start: ${input.from}, Ziel: ${input.to}, Datum: ${input.date}, Uhrzeit: ${input.time}`;
}

export function buildTimetableAnswer(
  raw: { result: SearchResult; request: { time: string } },
  language: McpLanguage
): string {
  const copy = language === "fr"
    ? {
        error: "Je n'ai pas pu lire l'horaire pour le moment.",
        noConnections: "Je n'ai pas trouvé de liaison appropriée.",
        direct: "direct",
        change: "correspondance",
        changes: "correspondances",
      }
    : {
        error: "Ich konnte den Fahrplan gerade nicht lesen.",
        noConnections: "Ich habe keine passende Verbindung gefunden.",
        direct: "direkt",
        change: "Umstieg",
        changes: "Umstiege",
      };

  if (raw.result.error) {
    return `${copy.error} ${raw.result.error}`;
  }

  const connection = pickBestTimetableConnection(raw.result, raw.request);
  if (!connection) {
    return copy.noConnections;
  }

  const changesText = connection.changes === 0
    ? copy.direct
    : `${connection.changes} ${connection.changes === 1 ? copy.change : copy.changes}`;
  const platformText = formatMarkdownPlatformLabel(language, connection.platform);

  return [
    `# ${raw.result.from} → ${raw.result.to}`,
    "",
    language === "fr" ? "## Aperçu" : "## Überblick",
    language === "fr" ? "| Départ | Arrivée | Correspondances |" : "| Abfahrt | Ankunft | Umstiege |",
    "|---|---|---|",
    `| ${connection.departure}${platformText ? ` ${language === "fr" ? "sur" : "auf"} ${platformText}` : ""} | ${connection.arrival} | ${changesText} |`,
  ].join("\n");
}

export function buildTimetableDetailedAnswer(
  raw: { result: SearchResult; request: { from: string; to: string; date: string; time: string; isArrival: boolean } },
  language: McpLanguage
): string {
  const copy = language === "fr"
    ? {
        noConnections: "Je n'ai pas trouvé de liaison appropriée.",
        error: "Je n'ai pas pu lire l'horaire pour le moment.",
        direct: "direct",
        change: "correspondance",
        changes: "correspondances",
        duration: "Durée",
        changesLabel: "Correspondances",
        connection: "Détail du trajet",
      }
    : {
        noConnections: "Ich habe keine passende Verbindung gefunden.",
        error: "Ich konnte den Fahrplan gerade nicht lesen.",
        direct: "direkt",
        change: "Umstieg",
        changes: "Umstiege",
        duration: "Fahrtzeit",
        changesLabel: "Umstiege",
        connection: "Verbindungsdetails",
      };

  if (raw.result.error) {
    return `${copy.error} ${raw.result.error}`;
  }

  const connection = pickBestTimetableConnection(raw.result, raw.request);
  if (!connection) {
    return copy.noConnections;
  }

  const displayLegs = (connection.legs || []).filter((leg) => Boolean(leg.category?.trim() || (leg.number && leg.number !== "–")));
  const changesText = connection.changes === 0
    ? copy.direct
    : `${connection.changes} ${connection.changes === 1 ? copy.change : copy.changes}`;
  const durationLabel = formatDurationLabel(language, connection.duration);
  const departurePlatform = formatMarkdownPlatformLabel(language, connection.platform);
  const summaryHeading = language === "fr" ? "## Aperçu" : "## Überblick";

  const lines: string[] = [];
  lines.push(`# ${raw.result.from} → ${raw.result.to}`);
  lines.push("");
  lines.push(summaryHeading);
  lines.push("");
  lines.push(language === "fr" ? "| Départ | Arrivée | Durée | Correspondances |" : "| Abfahrt | Ankunft | Fahrtzeit | Umstiege |");
  lines.push("|---|---|---|---|");
  lines.push(`| ${connection.departure}${departurePlatform ? ` ${language === "fr" ? "sur" : "auf"} ${departurePlatform}` : ""} | ${connection.arrival} | ${durationLabel} | ${changesText} |`);

  if (displayLegs.length > 0) {
    lines.push("");
    lines.push(language === "fr" ? "## Détail du trajet" : "## Verbindungsdetails");
    displayLegs.forEach((leg, index) => {
      lines.push("");
      lines.push(...formatMarkdownLegSection(language, leg));
      const nextLeg = displayLegs[index + 1];
      const transferAssessment = connection.transferAssessments?.[index];
      if (nextLeg && transferAssessment) {
        lines.push("");
        lines.push(...formatMarkdownTransferSection(language, leg, nextLeg, transferAssessment));
      }
    });
  }

  const accessAssessment = connection.accessAssessment;
  if (accessAssessment) {
    lines.push("");
    lines.push(...formatMarkdownEndpointAssessment(language, "start", accessAssessment));
  }

  const destinationAssessment = connection.destinationAssessment;
  if (destinationAssessment) {
    lines.push("");
    lines.push(...formatMarkdownEndpointAssessment(language, "end", destinationAssessment));
  }

  return lines.join("\n");
}
