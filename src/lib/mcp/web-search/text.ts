export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeContentText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function uniqueLimited(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const value of values) {
    const cleaned = normalizeContentText(value).replace(/^[\s:;,-]+|[\s:;,-]+$/g, "");
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    kept.push(cleaned);
    if (kept.length >= limit) break;
  }

  return kept;
}

export function isNoisySearchTitle(value: string): boolean {
  return /(<style|<img|\.css-|display:|webkit-|height=|width=|favicon)/i.test(value) || value.length > 180;
}

export function cleanSearchTitle(title: string, url: string): string {
  const cleaned = title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || isNoisySearchTitle(cleaned)) {
    return domainFromUrl(url) || cleaned;
  }

  return cleaned;
}

export function tokenizeSearchText(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3 && !["und", "oder", "der", "die", "das", "eine", "einen", "near", "von", "mit", "pour", "les", "des"].includes(token)))];
}

export function splitRow(value: string): string[] {
  return value
    .split(/\s+\|\s+|\t+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
