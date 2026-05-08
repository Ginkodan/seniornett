import { getLocaleTag, normalizeLanguage } from "@/lib/i18n";

import type { McpLanguage } from "../types";

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

const WEEKDAY_PATTERNS = [
  { pattern: /\b(montag|monday|lundi)\b/i, weekday: 1 },
  { pattern: /\b(dienstag|tuesday|mardi)\b/i, weekday: 2 },
  { pattern: /\b(mittwoch|wednesday|mercredi)\b/i, weekday: 3 },
  { pattern: /\b(donnerstag|thursday|jeudi)\b/i, weekday: 4 },
  { pattern: /\b(freitag|friday|vendredi)\b/i, weekday: 5 },
  { pattern: /\b(samstag|saturday|samedi)\b/i, weekday: 6 },
  { pattern: /\b(sonntag|sunday|dimanche)\b/i, weekday: 0 },
];

function getZurichWeekdayNumber(now = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Zurich",
  }).format(now).toLowerCase();

  switch (weekday) {
    case "sun":
      return 0;
    case "mon":
      return 1;
    case "tue":
      return 2;
    case "wed":
      return 3;
    case "thu":
      return 4;
    case "fri":
      return 5;
    case "sat":
      return 6;
    default:
      return 0;
  }
}

function resolveWeekdayOffset(targetWeekday: number, now = new Date()): number {
  const currentWeekday = getZurichWeekdayNumber(now);
  return (targetWeekday - currentWeekday + 7) % 7;
}

export function shouldUseDateTimeTool(message: string): boolean {
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

  for (const entry of WEEKDAY_PATTERNS) {
    if (entry.pattern.test(message)) {
      return resolveWeekdayOffset(entry.weekday);
    }
  }

  return null;
}

export function resolveRelativeDateIso(daysOffset: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).formatToParts(now);

  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");

  const target = new Date(Date.UTC(year, month - 1, day + daysOffset));
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(target);
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
