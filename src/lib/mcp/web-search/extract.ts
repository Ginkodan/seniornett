import type { WebSearchDocumentFact, WebSearchExtractedInfo, WebSearchScheduleRow } from "./types";
import { extractDocumentLookupFacts } from "./document-lookup";
import { isNoisySearchTitle, normalizeContentText, splitRow, uniqueLimited } from "./text";

function removeRepeatedWords(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length % 2 !== 0) return value;
  const half = words.length / 2;
  const left = words.slice(0, half).join(" ").toLowerCase();
  const right = words.slice(half).join(" ").toLowerCase();
  return left === right ? words.slice(0, half).join(" ") : value;
}

function cleanScheduleCell(value: string): string {
  return removeRepeatedWords(value.replace(/\s+/g, " ").replace(/^[\s,;:-]+|[\s,;:-]+$/g, "").trim());
}

function isEventDateTime(value: string): boolean {
  return /\b(?:mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun|lun|mar|mer|jeu|ven|sam|dim)\.?\s+\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?,?\s+\d{1,2}[:.]\d{2}\b/i.test(value) ||
    /\b(?:mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun|lun|mar|mer|jeu|ven|sam|dim)\.?,?\s+\d{1,2}\.?\s+[A-Za-zÄÖÜäöüÀ-ÿ]+\.?\s+\d{4}\s+\d{1,2}[:.]\d{2}(?:\s*Uhr)?\b/i.test(value) ||
    /\b\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?,?\s+\d{1,2}[:.]\d{2}\b/.test(value);
}

function extractScheduleRows(text: string): WebSearchScheduleRow[] {
  const rows: WebSearchScheduleRow[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (!isEventDateTime(line)) continue;

    const cells = splitRow(line);
    if (cells.length >= 4 && isEventDateTime(cells[0])) {
      const dateTime = cleanScheduleCell(cells[0]);
      const shiftedLayout = cells.length >= 5;
      rows.push({
        dateTime,
        category: cleanScheduleCell(shiftedLayout ? cells[2] : cells[1]),
        title: cleanScheduleCell(shiftedLayout ? cells[3] : cells.slice(2, -1).join(" ")),
        venue: cleanScheduleCell(shiftedLayout ? cells[1] : cells.at(-1) || ""),
      });
      continue;
    }

    const match = line.match(/^(.{0,44}?(?:\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}\.?\s+[A-Za-zÄÖÜäöüÀ-ÿ]+\.?\s+\d{4}),?\s+\d{1,2}[:.]\d{2}(?:\s*Uhr)?)\s+(.+)$/i);
    if (!match) continue;
    const rest = match[2].trim();
    const parts = rest.split(/\s{2,}| - | – /).map((part) => part.trim()).filter(Boolean);
    rows.push({
      dateTime: cleanScheduleCell(match[1]),
      category: parts.length >= 3 ? cleanScheduleCell(parts[0]) : "",
      title: cleanScheduleCell(parts.length >= 3 ? parts.slice(1, -1).join(" ") : rest),
      venue: parts.length >= 3 ? cleanScheduleCell(parts.at(-1) || "") : "",
    });
  }

  return uniqueScheduleRows(rows, 80);
}

function uniqueScheduleRows(rows: WebSearchScheduleRow[], limit: number): WebSearchScheduleRow[] {
  const seen = new Set<string>();
  const kept: WebSearchScheduleRow[] = [];

  for (const row of rows) {
    const key = [row.dateTime, row.category, row.title, row.venue].join("|").toLowerCase();
    if (seen.has(key)) continue;
    if (!row.dateTime || !row.title) continue;
    seen.add(key);
    kept.push(row);
    if (kept.length >= limit) break;
  }

  return kept;
}

function extractDocumentFacts(text: string): WebSearchDocumentFact[] {
  const normalized = normalizeContentText(text);
  const facts: WebSearchDocumentFact[] = [];
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const isMostlyNumeric = (value: string) => {
    const compact = value.replace(/[^0-9]/g, "");
    return compact.length >= 4 && compact.length >= value.replace(/\s+/g, "").length * 0.6;
  };

  for (const line of lines) {
    const parts = splitRow(line);
    if (parts.length < 2) continue;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const label = parts[index].replace(/\s+/g, " ").trim();
      const value = parts[index + 1].replace(/\s+/g, " ").trim();
      if (!label || !value) continue;
      if (label.length > 80 || value.length > 160) continue;
      if (/^(koordinaten?|coordinates?|coordonnées?)$/i.test(label)) continue;
      if (/[°'""]/.test(label) || /[°'""]/.test(value)) continue;
      if (isMostlyNumeric(label) && isMostlyNumeric(value)) continue;
      if (label.length <= 2 && isMostlyNumeric(value)) continue;
      facts.push({ label, value, context: line });
    }
  }

  return uniqueDocumentFacts(facts, 80);
}

function uniqueDocumentFacts(facts: WebSearchDocumentFact[], limit: number): WebSearchDocumentFact[] {
  const seen = new Set<string>();
  const kept: WebSearchDocumentFact[] = [];

  for (const fact of facts) {
    const key = `${fact.label}|${fact.value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(fact);
    if (kept.length >= limit) break;
  }

  return kept;
}

type ExtractUsefulInfoOptions = {
  query?: string;
  searchedAt?: Date;
};

export function extractUsefulInfo(text: string, title?: string, options: ExtractUsefulInfoOptions = {}): WebSearchExtractedInfo {
  const normalized = normalizeContentText(text);
  const lines = uniqueLimited(normalized.split(/\n|(?<=\.)\s+(?=[A-ZÄÖÜÀ-Ÿ])/).map((line) => line.trim()), 180);
  const phoneMatches = normalized.match(/(?:\+41|0041|0)\s?(?:\(?\d{2}\)?|\d{2})[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}/g) ?? [];
  const emailMatches = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const openingHours = lines.filter((line) =>
    /\b(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|lun|mar|mer|jeu|ven|sam|dim|heute|today|ouvert|geöffnet|offen|closed|geschlossen)\b/i.test(line) &&
    /(\d{1,2}[:.]\d{2}|\d{1,2}\s?-\s?\d{1,2}|geschlossen|closed|ouvert|offen|geöffnet)/i.test(line)
  );
  const addresses = lines.filter((line) =>
    /\b(\d{4}\s+[A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüÀ-ÿ' -]+|[A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüÀ-ÿ' -]+(?:strasse|straße|gasse|weg|platz|quai|rue|route|avenue)\s+\d+[a-z]?)\b/.test(line)
  );

  const documentFacts = [
    ...extractDocumentFacts(normalized),
    ...(options.query && options.searchedAt ? extractDocumentLookupFacts(normalized, options.query, options.searchedAt) : []),
  ];

  return {
    phones: uniqueLimited(phoneMatches, 4),
    openingHours: uniqueLimited(openingHours, 8),
    addresses: uniqueLimited(addresses, 4),
    emails: uniqueLimited(emailMatches, 3),
    likelyNames: uniqueLimited([title && !isNoisySearchTitle(title) ? title : "", ...lines.filter((line) => line.length <= 80 && /^#{1,3}\s+[A-ZÄÖÜÀ-Ÿ]/.test(line))], 4),
    scheduleRows: extractScheduleRows(normalized),
    documentFacts: uniqueDocumentFacts(documentFacts, 120),
  };
}

export function formatExtractedInfo(extracted: WebSearchExtractedInfo, language: "de" | "fr"): string {
  const labels = language === "fr"
    ? { phones: "Téléphone", openingHours: "Horaires", addresses: "Adresse", emails: "E-mail" }
    : { phones: "Telefon", openingHours: "Öffnungszeiten", addresses: "Adresse", emails: "E-Mail" };

  return [
    extracted.addresses.length ? `**${labels.addresses}:** ${extracted.addresses.join(" | ")}` : "",
    extracted.openingHours.length ? `**${labels.openingHours}:** ${extracted.openingHours.join(" | ")}` : "",
    extracted.phones.length ? `**${labels.phones}:** ${extracted.phones.join(" | ")}` : "",
    extracted.emails.length ? `**${labels.emails}:** ${extracted.emails.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

export function formatScheduleRows(rows: WebSearchScheduleRow[], language: "de" | "fr"): string {
  if (!rows.length) return "";

  const headers = language === "fr"
    ? ["Date/heure", "Catégorie", "Quoi", "Lieu"]
    : ["Datum/Zeit", "Kategorie", "Was", "Ort"];
  const body = rows.slice(0, 60).map((row) =>
    `| ${[row.dateTime, row.category || "-", row.title, row.venue || "-"].map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`
  );

  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...body,
  ].join("\n");
}

export const _extractTestInternals = {
  extractScheduleRows,
  extractDocumentFacts,
};
