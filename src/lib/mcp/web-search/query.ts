import type { McpLanguage } from "../types";
import type { WebSearchInput } from "./types";

export function placeForSearch(input: WebSearchInput): string | undefined {
  const place = input.resolvedPlace?.trim() || input.location?.label?.trim();
  if (!place) return undefined;

  const postcodeCity = place.match(/\b\d{4}\s+([^,]+)/);
  if (postcodeCity?.[1]) return postcodeCity[1].trim();

  const parts = place.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /\d|strasse|straße|gasse|weg|platz|quai|rue|route|avenue/i.test(parts[0])) {
    return parts[1];
  }

  return parts[0] || place;
}

export function compactSearchPhrase(value: string): string {
  return value
    .replace(/[?!]/g, " ")
    .replace(/\b(welche|welcher|welches|was|wie|wann|wo|ist|sind|hat|haben|gibt|gib|mir|bitte|kann|ich|gerade|heute|morgen|nacht|nächste|naechste|nächstgelegene|naechstgelegene|in meiner nähe|in der nähe|near me|nearby|bei mir|zu mir|offen|geöffnet|finde|finden|bekomme|krieg(?:e)?|suche|fuer|für|vom|von|de|du|des|programme|programm|spielplan)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isScheduleQuery(value: string): boolean {
  return /\b(programm|spielplan|agenda|termine|veranstaltungen|events|programme|calendrier|horaire des événements)\b/i.test(value);
}

function isCollectionScheduleQuery(value: string): boolean {
  return /\b(abfuhr|abfuhrdaten|entsorgung|kehricht|abfall|sammlung|collecte|déchets|dechets|ordures)\b/i.test(value);
}

export function buildSearchQuery(input: WebSearchInput, language: McpLanguage): string {
  const query = input.query.trim();
  const place = placeForSearch(input);
  const queryLower = query.toLowerCase();
  const placeLower = place?.toLowerCase();

  const alreadyContainsPlace = Boolean(placeLower && queryLower.includes(placeLower));
  const hasExplicitPlaceHint = /\b(?:in|bei|at|à|sur)\s+(?!der\s+n(?:ä|ae)he|meiner\s+n(?:ä|ae)he|the\s+area|me\b)[A-Za-zÄÖÜäöüÀ-ÿ0-9]/i.test(query) ||
    /\bprès\s+de\s+[A-Za-zÀ-ÿ0-9]/i.test(query);

  let enrichedQuery = compactSearchPhrase(query) || query;
  if (isCollectionScheduleQuery(query)) {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "calendrier collecte déchets pdf" : "Entsorgungskalender Abfuhrdaten PDF"}`;
  } else if (isScheduleQuery(query)) {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "programme agenda événements dates" : "Programm Spielplan Veranstaltungen Termine"}`;
  } else if (input.intent === "opening_hours") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "horaires adresse téléphone" : "Öffnungszeiten Adresse Telefon"}`;
  } else if (input.intent === "emergency_pharmacy") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "pharmacie de garde numéro" : "Notfallapotheke Telefonnummer"}`;
  } else if (input.intent === "venue") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "adresse lieu officiel" : "Adresse offizieller Ort"}`;
  } else if (input.intent === "product") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "où acheter magasin prix" : "wo kaufen Geschäft Preis"}`;
  }

  if (place && !alreadyContainsPlace && !hasExplicitPlaceHint) {
    return `${enrichedQuery} ${place}`;
  }

  if (input.location && !hasExplicitPlaceHint) {
    const nearText = language === "fr" ? "près de" : "in der Nähe von";
    return `${enrichedQuery} ${nearText} ${input.location.latitude},${input.location.longitude}`;
  }

  return enrichedQuery;
}
