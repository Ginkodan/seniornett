import { isScheduleQuery } from "./query";
import { tokenizeSearchText } from "./text";
import type { WebSearchInput, WebSearchResult } from "./types";

export function scoreResult(input: WebSearchInput, result: WebSearchResult): number {
  const haystack = `${result.title} ${result.domain} ${result.snippet} ${result.text || ""} ${result.markdown || ""}`.toLowerCase();
  const queryTokens = tokenizeSearchText(input.query);
  const placeTokens = tokenizeSearchText(input.resolvedPlace || input.location?.label || "");
  let score = 0;

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 3;
  }
  for (const token of placeTokens) {
    if (haystack.includes(token)) score += 4;
  }

  if (result.extracted?.openingHours.length) score += input.intent === "opening_hours" ? 12 : 4;
  if (result.extracted?.scheduleRows.length) {
    score += isScheduleQuery(input.query) ? 18 : 6;
    score += Math.min(result.extracted.scheduleRows.length, 50);
  }
  if (result.extracted?.documentFacts?.length) score += Math.min(result.extracted.documentFacts.length, 20);
  if (result.extracted?.addresses.length) score += ["local", "venue", "opening_hours", "emergency_pharmacy"].includes(input.intent) ? 8 : 2;
  if (result.extracted?.phones.length) score += input.intent === "emergency_pharmacy" ? 8 : 3;
  if (/offiziell|official|kontakt|standort|filiale|adresse|horaires|öffnungszeiten/i.test(haystack)) score += 4;
  if (input.intent === "emergency_pharmacy" && /\b(notfall|notdienst|pharmacie de garde|urgence)\b/i.test(haystack)) score += 16;
  if (input.intent === "venue" && /\b(adresse|spielort|venue|lieu|standort|anfahrt)\b/i.test(haystack)) score += 8;
  if (input.intent === "venue" && /\b(programm|spielplan|agenda|termine|veranstaltungen|events|kalender|calendar|schedule)\b/i.test(haystack)) score += 8;
  if (input.intent === "product" && /\b(kaufen|erhältlich|verfügbar|filiale|shop|geschäft|magasin|acheter)\b/i.test(haystack)) score += 8;
  if (input.intent === "product" && placeTokens.length > 0) {
    if (/\b(standort|filiale|laden|shop|geschäft|geschaeft|markt|supermarkt|drogerie|apotheke|volg|coop|migros|aldi|landi|spar)\b/i.test(haystack)) {
      score += 10;
    } else if (!result.extracted?.addresses.length && !result.extracted?.phones.length) {
      score -= 8;
    }
  }
  if (input.intent === "venue" && !result.extracted?.addresses.length && !result.extracted?.scheduleRows.length && !result.extracted?.openingHours.length) {
    score -= 4;
  }
  if (input.intent === "opening_hours" && !result.extracted?.openingHours.length && !result.extracted?.scheduleRows.length) {
    score -= 5;
  }
  if (input.intent === "opening_hours" && /\bmigros\b/i.test(input.query)) {
    if (/\b(supermarkt|filiale|markt|geschäft|geschaeft|laden)\b/i.test(haystack)) score += 10;
    if (/\b(restaurant|restaurant\b)/i.test(haystack)) score -= 6;
  }
  if (/^(de|en|fr)\.wikipedia\.org$|^wikipedia\.org$|wikidata\.org|wikimedia\.org/i.test(result.domain)) {
    score -= input.intent === "venue" || input.intent === "opening_hours" || input.intent === "product" ? 14 : 8;
  }
  if (/(?:\/wiki\/|\/w\/index\.php)/i.test(result.url) && ["venue", "opening_hours", "product", "local", "emergency_pharmacy"].includes(input.intent)) {
    score -= 6;
  }
  if (/\.(pdf)(?:$|[?#])/i.test(result.url) && input.intent !== "topic") score -= 6;
  if (/(facebook|instagram|linkedin|youtube|tripadvisor)\./i.test(result.domain)) score -= 5;

  return score;
}

export function rankResults(input: WebSearchInput, results: WebSearchResult[]): WebSearchResult[] {
  return results
    .map((result, index) => ({ result, index, score: scoreResult(input, result) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.result);
}
