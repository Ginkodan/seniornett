import type { WebSearchDocumentFact } from "./types";

const WEEKDAY_INDEX: Record<string, number> = {
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
  so: 0,
};

const WEEKDAY_LABELS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function extractStreetTerms(query: string): string[] {
  const streetSuffix = "(?:strasse|straße|gasse|weg|platz|quai|rue|route|avenue|rain|allee)";
  const afterPreposition = new RegExp(`\\b(?:an|in|bei|auf|für|fuer|sur|à|a|près de)\\s+(?:der|die|das|dem|den|le|la|l')?\\s*([A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüßÀ-ÿ' -]+${streetSuffix})\\b`, "gi");
  const fallback = new RegExp(`\\b([A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüßÀ-ÿ'-]+${streetSuffix})\\b`, "g");
  const matches = [...query.matchAll(afterPreposition)];
  const source = matches.length ? matches : [...query.matchAll(fallback)];

  return source
    .map((match) => match[1].replace(/^(?:der|die|das|dem|den)\s+/i, "").trim())
    .filter(Boolean);
}

function findGroupForTerm(text: string, term: string): { group: string; context: string } | null {
  const compactText = text.replace(/\s+/g, " ");
  const normalizedTerm = normalizeKey(term);
  const entryPattern = /\b([A-Z]\d?)\s+([A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüßÀ-ÿ' .,+/-]+?)(?=\s+[A-Z]\d?\s+[A-ZÄÖÜÀ-Ÿ]|\s+Lesebeispiel|\s+Legende|\s*$)/g;

  for (const match of compactText.matchAll(entryPattern)) {
    const group = match[1].replace(/\s+/g, "");
    const label = match[2].trim();
    if (!normalizeKey(label).includes(normalizedTerm)) continue;
    return { group, context: `${group} ${label}` };
  }

  return null;
}

function findWeekdayRule(text: string, group: string): string[] {
  const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactPattern = new RegExp(`\\b${escapedGroup}\\s+((?:Mo|Di|Mi|Do|Fr|Sa|So)(?:\\s*/\\s*(?:Mo|Di|Mi|Do|Fr|Sa|So))+)\\b`);
  const exact = text.match(exactPattern);
  if (exact?.[1]) return parseWeekdays(exact[1]);

  const letter = group[0];
  const letterPattern = new RegExp(`\\b${letter}\\s+((?:Mo|Di|Mi|Do|Fr|Sa|So)(?:\\s*/\\s*(?:Mo|Di|Mi|Do|Fr|Sa|So))+)\\b`);
  const byLetter = text.match(letterPattern);
  return byLetter?.[1] ? parseWeekdays(byLetter[1]) : [];
}

function parseWeekdays(value: string): string[] {
  return value
    .split("/")
    .map((part) => part.trim().slice(0, 2))
    .filter((part) => part.toLowerCase() in WEEKDAY_INDEX);
}

function nextDateForWeekdays(weekdays: string[], now: Date): Date | null {
  const targets = weekdays.map((weekday) => WEEKDAY_INDEX[weekday.toLowerCase()]).filter((weekday) => weekday !== undefined);
  if (!targets.length) return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (targets.includes(candidate.getDay())) return candidate;
  }

  return null;
}

function formatSwissDate(date: Date): string {
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday}, ${day}.${month}.${date.getFullYear()}`;
}

export function extractDocumentLookupFacts(text: string, query: string, searchedAt: Date): WebSearchDocumentFact[] {
  const facts: WebSearchDocumentFact[] = [];
  const terms = extractStreetTerms(query);
  if (!terms.length) return facts;

  for (const term of terms) {
    const groupMatch = findGroupForTerm(text, term);
    if (!groupMatch) continue;

    facts.push({
      label: term,
      value: groupMatch.group,
      context: groupMatch.context,
    });

    const weekdays = findWeekdayRule(text, groupMatch.group);
    if (!weekdays.length) continue;

    facts.push({
      label: groupMatch.group,
      value: weekdays.join(" / "),
      context: `${groupMatch.group} ${weekdays.join(" / ")}`,
    });

    const nextDate = nextDateForWeekdays(weekdays, searchedAt);
    if (nextDate) {
      facts.push({
        label: "Nächster Termin",
        value: formatSwissDate(nextDate),
        context: `${term} -> ${groupMatch.group} -> ${weekdays.join(" / ")}`,
      });
    }
  }

  return facts;
}

export const _documentLookupTestInternals = {
  extractStreetTerms,
  findGroupForTerm,
  findWeekdayRule,
  nextDateForWeekdays,
};
