import { getLocaleTag, normalizeLanguage } from "@/lib/i18n";

import type { LottiCapability, LottiCapabilityLanguage } from "./weather";

export const dateTimeCapability: LottiCapability = {
  id: "date-time",
  toolName: "datetime",
  title: {
    de: "Datum & Uhrzeit",
    fr: "Date & heure",
  },
  summary: {
    de: "Verwende diese Fähigkeit für Fragen nach Datum, Wochentag oder Uhrzeit.",
    fr: "Utilise cette capacité pour les questions sur la date, le jour ou l'heure.",
  },
  instructions: {
    de: [
      "Nutze die aktuelle Systemzeit statt zu raten.",
      "Antworte kurz und klar.",
      "Nenne Datum und Uhrzeit in der Sprache des Gesprächs.",
    ],
    fr: [
      "Utilise l'heure système actuelle au lieu d'inventer.",
      "Réponds brièvement et clairement.",
      "Donne la date et l'heure dans la langue de la conversation.",
    ],
  },
};

const DATE_TIME_KEYWORDS = [
  /\b(uhr|uhrzeit|zeit|datum|heute|jetzt|wochentag|tag)\b/i,
  /\b(heure|date|aujourd'hui|maintenant|jour)\b/i,
];

const RELATIVE_DAY_PATTERNS = [
  { pattern: /\b(morgen|tomorrow|demain)\b/i, days: 1 },
  { pattern: /\b(übermorgen|uebermorgen|after\s+tomorrow|après\s+demain)\b/i, days: 2 },
  { pattern: /\b(heute|today|aujourd'hui)\b/i, days: 0 },
];

const RELATIVE_DAY_NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  einem: 1,
  einer: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  funf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

export function shouldUseDateTimeCapability(message: string): boolean {
  return DATE_TIME_KEYWORDS.some((pattern) => pattern.test(message));
}

export function extractRelativeDayOffset(message: string): number | null {
  for (const entry of RELATIVE_DAY_PATTERNS) {
    if (entry.pattern.test(message)) {
      return entry.days;
    }
  }

  const numericMatch = message.match(/\b(?:in|für|fur|after)\s+(\d+)\s+(?:tag(?:e|en)?|days?|tagen?)\b/i);
  if (numericMatch?.[1]) {
    return Math.max(0, Number.parseInt(numericMatch[1], 10));
  }

  for (const [word, days] of Object.entries(RELATIVE_DAY_NUMBER_WORDS)) {
    const wordPattern = new RegExp(`\\b(?:in|für|fur|after)\\s+${word}\\s+(?:tag(?:e|en)?|days?|tagen?)\\b`, "i");
    if (wordPattern.test(message)) {
      return days;
    }
  }

  return null;
}

export function buildDateTimeAnswer(language: LottiCapabilityLanguage, now = new Date()): string {
  const locale = normalizeLanguage(language);
  const localeTag = getLocaleTag(locale);

  const date = new Intl.DateTimeFormat(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(now);

  const time = new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Zurich",
  }).format(now);

  return locale === "fr"
    ? `Nous sommes le ${date}, il est ${time}.`
    : `Heute ist ${date}, es ist ${time} Uhr.`;
}
