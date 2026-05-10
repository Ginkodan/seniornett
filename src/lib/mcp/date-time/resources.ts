import { getLocaleTag, normalizeLanguage } from "@/lib/i18n";
export {
  extractRelativeDayOffset,
  getZurichDateTimeParts,
  resolveRelativeDateIso,
} from "@/lib/date-utils";

import type { McpLanguage } from "../types";
const DATE_TIME_KEYWORDS = [
  /\b(uhr|uhrzeit|zeit|datum|heute|jetzt|wochentag|tag)\b/i,
  /\b(heure|date|aujourd'hui|maintenant|jour)\b/i,
];

export function shouldUseDateTimeTool(message: string): boolean {
  return DATE_TIME_KEYWORDS.some((pattern) => pattern.test(message));
}

export function buildDateTimeAnswer(language: McpLanguage, now = new Date()): string {
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
    ? `# Date & heure\n- **Date:** \`${date}\`\n- **Heure:** \`${time}\``
    : `# Datum & Uhrzeit\n- **Datum:** \`${date}\`\n- **Uhrzeit:** \`${time} Uhr\``;
}
