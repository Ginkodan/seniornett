import type { WeatherResult } from "@/app/actions/weather";

import type { McpLanguage } from "../types";
import { extractRelativeDayOffset } from "../date-time/resources";

export function shouldUseWeatherTool(message: string): boolean {
  return [
    /\b(wetter|wetterbericht|prognose|vorhersage|regen|schnee|wind|temperatur|sonne)\b/i,
    /\b(meteo|météo|pluie|neige|vent|température|prévision)\b/i,
  ].some((pattern) => pattern.test(message));
}

function normalizeWeatherQueryText(message: string): string {
  let value = message.trim();

  for (const pattern of [
    /\b(?:in|für|fur)\s+(\d+|einem?|einer?|ein|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn)\s+(?:tag(?:e|en)?|days?)\b/gi,
    /\b(?:in|für|fur)\s+(morgen|heute|heut|tomorrow|today|demain)\b/gi,
    /\b(?:am|on|le|à|a)\s+(montag|monday|lundi|dienstag|tuesday|mardi|mittwoch|wednesday|mercredi|donnerstag|thursday|jeudi|freitag|friday|vendredi|samstag|saturday|samedi|sonntag|sunday|dimanche)\b/gi,
    /\b(montag|monday|lundi|dienstag|tuesday|mardi|mittwoch|wednesday|mercredi|donnerstag|thursday|jeudi|freitag|friday|vendredi|samstag|saturday|samedi|sonntag|sunday|dimanche)\b/gi,
  ]) {
    value = value.replace(pattern, " ");
  }

  return value.replace(/\s+/g, " ").trim();
}

export function extractWeatherLocation(message: string): string | null {
  const trimmed = normalizeWeatherQueryText(message);
  const patterns = [
    /\b(?:in|für|fur|bei|um)\s+([A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÄÖÜäöüßÀ-ÿ0-9'().-]+)*)/i,
    /\b(?:à|a)\s+([A-Za-zÀ-ÿ0-9'().-]+(?:\s+[A-Za-zÀ-ÿ0-9'().-]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) continue;

    const value = match[1]
      .replace(/[?.!,]+$/g, "")
      .replace(/\b(morgen|heute|heut|tomorrow|today|demain|aujourd'hui)\b/gi, "")
      .trim();

    if (value) {
      return value;
    }
  }

  return null;
}

export function extractWeatherDayIndex(message: string): number {
  return extractRelativeDayOffset(message) ?? 0;
}

export function resolveWeatherLocation(message: string, history: Array<{ role: "user" | "assistant"; text: string }>): string | null {
  const explicitQuery = extractWeatherLocation(message);
  if (explicitQuery) {
    return explicitQuery;
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.role !== "user") continue;
    const previousQuery = extractWeatherLocation(entry.text);
    if (previousQuery) {
      return previousQuery;
    }
  }

  return null;
}

export function buildWeatherContext(weather: WeatherResult, language: McpLanguage): string {
  const lines: string[] = [];
  lines.push(language === "fr" ? "## Aperçu météo" : "## Wetterübersicht");
  lines.push(`- **${language === "fr" ? "Lieu" : "Ort"}:** ${weather.city || (language === "fr" ? "inconnu" : "unbekannt")}`);

  if (weather.error) {
    lines.push(`- **${language === "fr" ? "Erreur" : "Fehler"}:** ${weather.error}`);
    return lines.join("\n");
  }

  lines.push("");
  lines.push(language === "fr" ? "## Jours" : "## Tage");
  lines.push(language === "fr" ? "| Jour | Température | Pluie | Détails |" : "| Tag | Temperatur | Regen | Details |");
  lines.push("|---|---:|---:|---|");

  for (const day of weather.days.slice(0, 3)) {
    const precipitation = day.precipMm > 0
      ? `${day.precipMm} mm`
      : language === "fr"
        ? "sec"
        : "trocken";
    const hourly = day.hourly?.length ? `${day.hourly.length} ${language === "fr" ? "courbes horaires" : "Zeitverläufe"}` : "-";

    lines.push(`| **${day.dayLabel}** | ${day.tempMax}° / ${day.tempMin}° | ${precipitation} | ${hourly} |`);
  }

  return lines.join("\n");
}

export function buildWeatherAnswer(weather: WeatherResult, language: McpLanguage, dayIndex = 0): string {
  if (weather.error) {
    return language === "fr"
      ? `Je ne peux pas lire la météo pour le moment. ${weather.error}`
      : `Ich kann das Wetter gerade nicht lesen. ${weather.error}`;
  }

  const day = weather.days[Math.min(dayIndex, Math.max(0, weather.days.length - 1))];
  if (!day) {
    return language === "fr"
      ? "Je n'ai pas trouvé de données météo pour cet endroit."
      : "Ich habe für diesen Ort keine Wetterdaten gefunden.";
  }

  const locationPart = weather.city ? `${weather.city}: ` : "";
  const rainPart = day.precipMm > 0
    ? `${day.precipMm} mm ${language === "fr" ? "de pluie" : "Regen"}`
    : language === "fr"
      ? "pas de pluie"
      : "kein Regen";
  const snowPart = day.label.toLowerCase().includes("schnee") || day.emoji.includes("❄")
    ? language === "fr" ? "neige possible" : "Schnee möglich"
    : language === "fr" ? "pas de neige" : "kein Schnee";

  const headline = language === "fr"
    ? `# ${locationPart}${day.dayLabel}\n| Valeur | Prévision |\n|---|---|\n| Températures | ${day.tempMax}° / ${day.tempMin}° |\n| Pluie | ${rainPart} |\n| Neige | ${snowPart} |`
    : `# ${locationPart}${day.dayLabel}\n| Wert | Vorhersage |\n|---|---|\n| Temperaturen | ${day.tempMax}° / ${day.tempMin}° |\n| Regen | ${rainPart} |\n| Schnee | ${snowPart} |`;

  return day.hourly?.length
    ? `${headline}\n| ${language === "fr" ? "Courbes horaires" : "Zeitverläufe"} | ${day.hourly.length} |`
    : headline;
}

export function buildWeatherRequestSummary(location: string, dayIndex: number, language: McpLanguage): string {
  return language === "fr" ? `Lieu: ${location}, jour: ${dayIndex}` : `Ort: ${location}, Tag: ${dayIndex}`;
}

export function buildWeatherClarification(language: McpLanguage): string {
  return language === "fr" ? "Pour quel endroit veux-tu la météo ?" : "Für welchen Ort möchtest du das Wetter wissen?";
}

export function extractDayIndexFromSummary(summary: string): number {
  const match = summary.match(/\b(?:jour|Tag|day):\s*(\d+)\b/i);
  return match?.[1] ? Math.max(0, Number.parseInt(match[1], 10)) : 0;
}
