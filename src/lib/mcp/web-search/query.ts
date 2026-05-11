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
    .replace(/\bbatterien?\s+(?:für|fuer)\s+(?:ein(?:e|en|es)?\s+)?hörgerät\b/gi, "Hörgerätebatterien")
    .replace(/\bhörgerät(?:e)?\s+batterien?\b/gi, "Hörgerätebatterien")
    .replace(/\blactosefrei(?:e|er|es|en)?\b/gi, "laktosefrei")
    .replace(/\blactose\b/gi, "laktose")
    .replace(/[?!]/g, " ")
    .replace(/\b(welche|welcher|welches|was|wie|wann|wo|ist|sind|hat|haben|gibt|gib|mir|bitte|kann|ich|gerade|heute|morgen|nacht|am|nächste|nächsten|naechste|naechsten|nächstgelegene|nächstgelegenen|naechstgelegene|naechstgelegenen|in meiner nähe|in der nähe|near me|nearby|bei mir|zu mir|offen|geöffnet|finde|finden|bekomme|krieg(?:e)?|suche|fuer|für|vom|von|de|du|des|programme|programm|spielplan)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isScheduleQuery(value: string): boolean {
  return /\b(programm|spielplan|agenda|termine|veranstaltungen|events|programme|calendrier|horaire des événements)\b/i.test(value) ||
    (/\b(konzert|konzerte|concert|concerts|theater|opern?|spectacle|spectacles)\b/i.test(value) &&
      /\b(heute|morgen|diese\s+woche|dieses\s+wochenende|wann|welche|welcher|welches|gibt|today|tomorrow|this\s+week|tonight|ce\s+soir|cette\s+semaine)\b/i.test(value));
}

function isCollectionScheduleQuery(value: string): boolean {
  return /\b(\w*abfuhr(?:daten)?|entsorgungskalender|abfallkalender|kehricht|abfall|sammlung|papiersammlung|papier|karton|collecte|déchets|dechets|ordures)\b/i.test(value);
}

function isDisposalLookup(value: string): boolean {
  return /\b(entsorgung|entsorge|entsorgen|sonderabfall|altmedikamente|medikamente|recyclinghof|entsorgungshof)\b/i.test(value);
}

function isLocalProductLookup(value: string): boolean {
  return /\b(in der nähe|in der naehe|near me|nearby|bei mir|zu mir)\b/i.test(value) ||
    /\bwo\s+(?:bekomme|kriege|finde)\s+ich\b/i.test(value) ||
    /\bwo\s+kann\s+ich\b.*\bkaufen\b/i.test(value) ||
    /\bkaufen\b.*\b(?:in|bei|nahe|nähe|naehe|près de)\b/i.test(value);
}

function isProductComparisonLookup(value: string): boolean {
  return /\b(vergleich|vergleiche|empfehlenswert|empfehlung|test|beste|unterschied|unterschiede)\b/i.test(value);
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
  } else if (isDisposalLookup(query)) {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "élimination déchets lieu officiel" : "Entsorgung Abgabestelle offizieller Ort"}`;
  } else if (isScheduleQuery(query)) {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "programme agenda événements dates" : "Programm Spielplan Veranstaltungen Termine"}`;
  } else if (input.intent === "opening_hours") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "horaires adresse téléphone" : "Öffnungszeiten Adresse Telefon"}`;
    if (/\bmigros\b/i.test(query)) {
      enrichedQuery = `${enrichedQuery} ${language === "fr" ? "supermarché filiale" : "Supermarkt Filiale"}`;
    }
  } else if (input.intent === "emergency_pharmacy") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "pharmacie de garde numéro" : "Notfallapotheke Telefonnummer"}`;
  } else if (input.intent === "venue") {
    enrichedQuery = `${enrichedQuery} ${language === "fr" ? "adresse lieu officiel" : "Adresse offizieller Ort"}`;
  } else if (input.intent === "product") {
    if (isLocalProductLookup(query)) {
      enrichedQuery = `${enrichedQuery} ${language === "fr" ? "magasin commerce prix" : "Laden Geschäft Supermarkt Preis"}`;
    } else if (isProductComparisonLookup(query)) {
      enrichedQuery = `${enrichedQuery} ${language === "fr" ? "comparatif test recommandation prix" : "Vergleich Test Empfehlung Preis"}`;
    } else {
      enrichedQuery = `${enrichedQuery} ${language === "fr" ? "prix informations officielles" : "Preis offizielle Informationen"}`;
    }
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
