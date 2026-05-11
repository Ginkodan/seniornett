import { z } from "zod";

import { inferStructuredJson } from "../structured-json";
import type { ChatHistoryEntry, McpLanguage, McpTool, McpToolContext, McpToolObservation, McpToolRequestResolution } from "../types";
import { shouldUseNearbyPlaceTool } from "../nearby-place/prompts";
import { isLocalWebSearchMessage, shouldUseWebSearchTool, webSearchPrompt } from "./prompts";
import { buildWebSearchObservation, performWebSearch, type WebSearchInput, type WebSearchIntent, type WebSearchRaw } from "./resources";

const WebSearchRequestSchema = z
  .object({
    ok: z.boolean(),
    query: z.string().trim().min(1).nullable().optional(),
    intent: z.enum(["local", "opening_hours", "emergency_pharmacy", "venue", "product", "topic"]).nullable().optional(),
    needsLocation: z.boolean().optional(),
    clarification: z.string().trim().nullable().optional(),
  })
  .strict();

type ResolvedPlace = {
  label: string | null;
  addressLine: string | null;
  city: string | null;
  source: string | null;
};

type NearbyResolvedPlace = {
  label: string | null;
  resolvedPlace: string | null;
  addressLine: string | null;
  city: string | null;
  source: string | null;
};

function normalizePlaceCandidate(value: string): string {
  const cleaned = value
    .replace(/\b(am|an|im|on|le|à)\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b.*$/i, "")
    .replace(/\b(heute|morgen|heute nacht|diese woche|today|tomorrow|tonight|this week|aujourd'hui|demain|ce soir|cette semaine)\b.*$/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean);
  const stopWords = new Set([
    "kaufen", "offen", "geöffnet", "geoeffnet", "finden", "finde", "bekomme", "kriege", "gibt", "wo", "kann", "ich", "die", "das",
    "nächste", "naechste", "programm", "spielplan", "termine", "veranstaltungen",
  ]);
  const kept: string[] = [];
  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    if (stopWords.has(lowerToken) && kept.length > 0) {
      break;
    }
    if (kept.length > 0 && /^[a-zäöüßà-ÿ]/.test(token) && !["am", "an", "der", "die", "das", "de", "du", "des", "la", "le", "les", "of", "and"].includes(lowerToken)) {
      break;
    }
    kept.push(token);
    if (kept.length >= 3) break;
  }

  return kept.join(" ").trim();
}

function isNonPlacePhrase(value: string): boolean {
  if (/(nähe|naehe|near me|nearby)/i.test(value)) return true;
  if (/\b(stromausfall|blackout|notfallplan|notvorrat|krisenfall|selbstvorsorge)\b/i.test(value)) return true;
  return /^(?:in\s+)?(?:der|die|dem|meiner?|deiner?|unserer?)?\s*(nähe|naehe)$|^(nearby|near me|hier|hierbei)$/i.test(value);
}

function isInformationalTopicMessage(value: string): boolean {
  return /\b(stromausfall|blackout|notfallplan|notvorrat|krisenfall|selbstvorsorge|warnzeichen|telefonbetrug|betrug|phishing|rechte|flugverspätung|flugverspaetung|e-id|grippeimpfung|twint|falsche zahlung|patientenverfügung|patientenverfuegung|ahv-rente|ahv rente)\b/i.test(value);
}

function extractExplicitPlaceFromMessage(message: string): string | undefined {
  const patterns = [
    /\b(?:programm|spielplan|agenda|termine|veranstaltungen|events)\s+(?:vom|von|für|fuer|de|du|des)\s+([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+){0,4})/i,
    /\b(?:vom|von)\s+([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+){0,4})/i,
    /\b(?:in|bei|nahe|nähe|naehe|um)\s+([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+){0,4})/i,
    /\b(?:à|a|près de)\s+([A-Za-zÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÀ-ÿ0-9'().-]+){0,4})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    if (isNonPlacePhrase(raw)) continue;
    const value = normalizePlaceCandidate(raw);
    if (!value || isNonPlacePhrase(value)) continue;
    return value;
  }

  return undefined;
}

function fallbackIntent(message: string): WebSearchIntent {
  if (/\b(notfallapotheke|pharmacie de garde)\b/i.test(message)) return "emergency_pharmacy";
  if (/(öffnungszeit(?:en)?|oeffnungszeit(?:en)?|\boffen\b|geöffnet|geoeffnet|\bhoraire\b|\bhoraires\b|\bouvert\b)/i.test(message)) return "opening_hours";
  if (/\b(theater|oper|opernhaus|konzert|konzerte|veranstaltung|veranstaltungen|event|events|programm|spielplan|agenda|termine|museum|ausstellung|ausstellungen|venue|lieu|opéra|concert)\b/i.test(message)) return "venue";
  if (isInformationalTopicMessage(message)) return "topic";
  if (/\b(smartphone|handy|telefon|hörgerät|hoergeraet|batterietyp|batterie|batterien|app|apps|gerät|geraet|produkt)\b/i.test(message) && /\b(kaufen|bekomme|vergleich|vergleiche|empfehlenswert|empfehlung|test|beste|einfach(?:e|en|es)?)\b/i.test(message)) return "product";
  if (/\b(kaufen|bekomme|produkt|acheter|trouver|wo bekomme ich|wo finde ich)\b/i.test(message)) return "product";
  if (/\b(\w*abfuhr(?:daten)?|entsorgung|entsorge|entsorgen|kehricht|abfall|sammlung|papiersammlung|papier|karton|toilette|wc|collecte|déchets|dechets|ordures)\b/i.test(message)) return "local";
  if (isLocalWebSearchMessage(message)) return "local";
  return "topic";
}

function isLocalIntent(intent: WebSearchIntent): boolean {
  return ["local", "opening_hours", "emergency_pharmacy", "venue"].includes(intent);
}

function productNeedsLocalContext(message: string): boolean {
  return /\b(in der nähe|in der naehe|near me|nearby|bei mir|zu mir)\b/i.test(message) ||
    /\bwo\s+(?:bekomme|kriege|finde)\s+ich\b/i.test(message) ||
    /\bwo\s+kann\s+ich\b.*\bkaufen\b/i.test(message) ||
    /\bkaufen\b.*\b(?:in|bei|nahe|nähe|naehe|près de)\b/i.test(message);
}

function isLocationAwareIntent(intent: WebSearchIntent, message: string): boolean {
  return isLocalIntent(intent) || (intent === "product" && productNeedsLocalContext(message));
}

function buildClarification(language: McpLanguage): string {
  return language === "fr" ? "Pour quel lieu dois-je chercher ?" : "Für welchen Ort soll ich suchen?";
}

function buildHistoryBlock(history: ChatHistoryEntry[]): string {
  return history
    .slice(-6)
    .map((entry) => `${entry.role === "user" ? "User" : "Lotti"}: ${entry.text}`)
    .join("\n");
}

function readResolvedPlace(context: McpToolContext): ResolvedPlace | null {
  const observation = [...context.trace].reverse().find((entry) => entry.toolName === "coordinate_to_address" && entry.status === "ok" && entry.payload);
  if (!observation?.payload) {
    return null;
  }

  try {
    const payload = JSON.parse(observation.payload) as Partial<ResolvedPlace>;
    return {
      label: typeof payload.label === "string" ? payload.label : null,
      addressLine: typeof payload.addressLine === "string" ? payload.addressLine : null,
      city: typeof payload.city === "string" ? payload.city : null,
      source: typeof payload.source === "string" ? payload.source : null,
    };
  } catch {
    return null;
  }
}

function readNearbyPlace(context: McpToolContext): NearbyResolvedPlace | null {
  const observation = [...context.trace].reverse().find((entry) => entry.toolName === "nearby_place" && entry.status === "ok" && entry.payload);
  if (!observation?.payload) {
    return null;
  }

  try {
    const payload = JSON.parse(observation.payload) as Partial<NearbyResolvedPlace>;
    return {
      label: typeof payload.label === "string" ? payload.label : typeof payload.resolvedPlace === "string" ? payload.resolvedPlace : null,
      resolvedPlace: typeof payload.resolvedPlace === "string" ? payload.resolvedPlace : null,
      addressLine: typeof payload.addressLine === "string" ? payload.addressLine : null,
      city: typeof payload.city === "string" ? payload.city : null,
      source: typeof payload.source === "string" ? payload.source : null,
    };
  } catch {
    return null;
  }
}

function bestResolvedPlace(place: ResolvedPlace | null): string | undefined {
  return place?.label || place?.addressLine || place?.city || undefined;
}

function bestNearbyResolvedPlace(place: NearbyResolvedPlace | null): string | undefined {
  return place?.label || place?.resolvedPlace || place?.addressLine || place?.city || undefined;
}

function buildRequestSummary(input: WebSearchInput, language: McpLanguage): string {
  const place = input.resolvedPlace || input.location?.label;
  const placeText = place || (input.location ? `${input.location.latitude.toFixed(5)},${input.location.longitude.toFixed(5)}` : null);

  if (language === "fr") {
    return [`Recherche web: ${input.query}`, `intention: ${input.intent}`, placeText ? `lieu: ${placeText}` : null].filter(Boolean).join("; ");
  }

  return [`Websuche: ${input.query}`, `Absicht: ${input.intent}`, placeText ? `Ort: ${placeText}` : null].filter(Boolean).join("; ");
}

function isWeatherMessage(message: string): boolean {
  return /\b(wetter|temperatur|regen|schnee|vorhersage|forecast)\b/i.test(message);
}

function refineIntent(message: string, intent: WebSearchIntent): WebSearchIntent {
  const lowered = message.toLowerCase();
  const asksForOpeningHours = /(öffnungszeit(?:en)?|oeffnungszeit(?:en)?|\boffen\b|geöffnet|geoeffnet|\bhoraire\b|\bhoraires\b|\bouvert\b|\bsonntag\b|\bmontag\b|\bdienstag\b|\bmittwoch\b|\bdonnerstag\b|\bfreitag\b|\bsamstag\b)/i.test(lowered);
  const asksForEmergencyPharmacy = /\b(notfallapotheke|apothekennotdienst|notdienstapotheke|pharmacie de garde)\b/i.test(lowered);

  if (asksForEmergencyPharmacy) {
    return "emergency_pharmacy";
  }

  if (asksForOpeningHours) {
    return "opening_hours";
  }

  if (/\b(theater|oper|opernhaus|konzert|konzerte|veranstaltung|veranstaltungen|event|events|programm|spielplan|agenda|termine|musée|museum|ausstellung|ausstellungen|opéra|concert)\b/i.test(lowered)) {
    return "venue";
  }

  if (isInformationalTopicMessage(lowered)) {
    return "topic";
  }

  if (intent === "emergency_pharmacy" && !asksForEmergencyPharmacy) {
    if (/\b(supermarkt|laden|geschäft|geschaeft|markt|shop|magasin|apotheke|pharmacie)\b/i.test(lowered)) return "opening_hours";
    if (/\b(apotheke|pharmacie)\b/i.test(lowered)) return "venue";
    return fallbackIntent(message);
  }

  if (intent === "topic" && /\b(wo bekomme ich|wo finde ich|kaufen|produkt)\b/i.test(lowered)) {
    return "product";
  }

  if (intent === "topic" && /\b(\w*abfuhr(?:daten)?|entsorgung|entsorge|entsorgen|kehricht|abfall|sammlung|papiersammlung|papier|karton|collecte|déchets|dechets|ordures)\b/i.test(lowered)) {
    return "local";
  }

  if (intent === "topic" && /\b(smartphone|handy|telefon|hörgerät|hoergeraet|batterietyp|batterie|batterien|app|apps|gerät|geraet)\b/i.test(lowered) && /\b(vergleich|vergleiche|empfehlenswert|empfehlung|test|beste|einfach(?:e|en|es)?)\b/i.test(lowered)) {
    return "product";
  }

  return intent;
}

function includeLocationInSearch(intent: WebSearchIntent, message: string): boolean {
  return isLocationAwareIntent(intent, message);
}

function hasDateTimeObservation(context: McpToolContext): boolean {
  return context.trace.some((entry) => entry.toolName === "datetime" && entry.status === "ok");
}

function hasNearbyPlaceObservation(context: McpToolContext): boolean {
  return context.trace.some((entry) => entry.toolName === "nearby_place" && entry.status === "ok");
}

function needsCurrentTime(message: string): boolean {
  return /\b(heute|jetzt|gerade|heute nacht|ce soir|aujourd'hui|maintenant)\b/i.test(message);
}

async function buildRequestViaModel(context: McpToolContext): Promise<McpToolRequestResolution<WebSearchInput> | null> {
  const { message, history, language, runtime } = context;
  const isFrench = language === "fr";
  const explicitPlace = extractExplicitPlaceFromMessage(message);
  const resolvedPlace = explicitPlace || bestNearbyResolvedPlace(readNearbyPlace(context)) || bestResolvedPlace(readResolvedPlace(context));
  const prompt = [
    isFrench ? "Tu extrais une requête de recherche web en JSON." : "Du extrahierst eine Websuch-Anfrage als JSON.",
    "Return only valid JSON.",
    `Schema: {"ok":true,"query":"...","intent":"local|opening_hours|emergency_pharmacy|venue|product|topic","needsLocation":false,"clarification":null}`,
    isFrench
      ? "Si la demande est locale et qu'aucun lieu, aucune position et aucun lieu résolu n'est disponible, mets needsLocation=true."
      : "Wenn die Anfrage lokal ist und weder Ort, Browser-Standort noch aufgelöster Ort verfügbar ist, setze needsLocation=true.",
    `Runtime location available: ${runtime?.location ? "yes" : "no"}`,
    `Resolved place: ${resolvedPlace || "none"}`,
    `History:\n${buildHistoryBlock(history) || "none"}`,
    `Message: ${message}`,
  ].join("\n\n");

  const result = await inferStructuredJson(prompt, WebSearchRequestSchema, {
    generation_options: {
      max_new_tokens: 256,
      temperature: 0.2,
      top_p: 1,
    },
  });

  if (!result.value) return null;

  if (result.value.ok === false) {
    return {
      ok: false,
      clarification: result.value.clarification || buildClarification(language),
    };
  }

  const query = result.value.query?.trim();
  const intent = refineIntent(message, result.value.intent || fallbackIntent(message));

  if (!query) return null;

  if (result.value.needsLocation && !runtime?.location && !resolvedPlace) {
    return {
      ok: false,
      clarification: result.value.clarification || buildClarification(language),
    };
  }

  const args: WebSearchInput = {
    query,
    intent,
    location: includeLocationInSearch(intent, message) && !explicitPlace ? runtime?.location : undefined,
    resolvedPlace: includeLocationInSearch(intent, message) ? resolvedPlace : undefined,
    maxResults: 6,
  };

  return {
    ok: true,
    args,
    requestSummary: buildRequestSummary(args, language),
  };
}

export const webSearchTool: McpTool<WebSearchInput, WebSearchRaw> = {
  id: webSearchPrompt.id,
  toolName: webSearchPrompt.toolName,
  title: webSearchPrompt.title,
  summary: webSearchPrompt.summary,
  instructions: webSearchPrompt.instructions,
  examples: webSearchPrompt.examples,
  responseInstructions: webSearchPrompt.responseInstructions,
  replyMode: webSearchPrompt.replyMode,
  sdk: {
    description: webSearchPrompt.summary.de,
    inputSchema: {
      query: z.string().trim().min(1).describe("Suchbegriff oder Frage"),
      intent: z.enum(["local", "opening_hours", "emergency_pharmacy", "venue", "product", "topic"]).default("topic"),
      resolvedPlace: z.string().trim().optional().describe("Bereits aufgelöster Ort oder Adresse"),
      location: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          accuracy: z.number().positive().optional(),
          label: z.string().optional(),
        })
        .optional(),
      maxResults: z.number().int().min(1).max(6).default(6),
    },
    annotations: {
      title: webSearchPrompt.title.de,
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  canHandle(context: McpToolContext): boolean {
    if (isWeatherMessage(context.message)) return false;
    return shouldUseWebSearchTool(context.message);
  },
  requires(context: McpToolContext): string[] {
    const intent = refineIntent(context.message, fallbackIntent(context.message));
    const hasLocation = Boolean(context.runtime?.location);
    const hasResolvedPlace = Boolean(bestResolvedPlace(readResolvedPlace(context)));
    const hasNearbyResolvedPlace = Boolean(bestNearbyResolvedPlace(readNearbyPlace(context)));
    const hasExplicitPlace = Boolean(extractExplicitPlaceFromMessage(context.message));
    const required: string[] = [];

    const nearbyPlaceLookupNeeded = shouldUseNearbyPlaceTool(context.message) && isLocationAwareIntent(intent, context.message) && !hasExplicitPlace && !hasNearbyResolvedPlace;

    if (nearbyPlaceLookupNeeded && !hasNearbyPlaceObservation(context)) {
      required.push("nearby_place");
    }

    if (isLocationAwareIntent(intent, context.message) && needsCurrentTime(context.message) && !hasDateTimeObservation(context) && !nearbyPlaceLookupNeeded) {
      required.push("datetime");
    }

    if (isLocationAwareIntent(intent, context.message) && hasLocation && !hasResolvedPlace && !hasExplicitPlace && !nearbyPlaceLookupNeeded) {
      required.push("coordinate_to_address");
    }

    return required;
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<WebSearchInput>> {
    const modelRequest = await buildRequestViaModel(context);
    if (modelRequest) {
      return modelRequest;
    }

    const intent = refineIntent(context.message, fallbackIntent(context.message));
    const explicitPlace = extractExplicitPlaceFromMessage(context.message);
    const resolvedPlace = explicitPlace || bestNearbyResolvedPlace(readNearbyPlace(context)) || bestResolvedPlace(readResolvedPlace(context));

    if (isLocationAwareIntent(intent, context.message) && !context.runtime?.location && !resolvedPlace && !/\b(in|bei|à|a|near|près)\b/i.test(context.message)) {
      return {
        ok: false,
        clarification: buildClarification(context.language),
      };
    }

    const args: WebSearchInput = {
      query: context.message,
      intent,
      location: includeLocationInSearch(intent, context.message) && !explicitPlace ? context.runtime?.location : undefined,
      resolvedPlace: includeLocationInSearch(intent, context.message) ? resolvedPlace : undefined,
      maxResults: 6,
    };

    return {
      ok: true,
      args,
      requestSummary: buildRequestSummary(args, context.language),
    };
  },
  async execute(args: WebSearchInput, language: McpLanguage): Promise<WebSearchRaw> {
    return await performWebSearch(args, language);
  },
  async renderObservation(result: WebSearchRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    return buildWebSearchObservation(result, language, requestSummary);
  },
};
