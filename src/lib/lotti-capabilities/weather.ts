import type { WeatherResult } from "@/app/actions/weather";

export type LottiCapabilityLanguage = "de" | "fr";

export interface LottiCapability {
  id: string;
  toolName: string;
  title: Record<LottiCapabilityLanguage, string>;
  summary: Record<LottiCapabilityLanguage, string>;
  instructions: Record<LottiCapabilityLanguage, string[]>;
}

export const weatherCapability: LottiCapability = {
  id: "weather",
  toolName: "weather",
  title: {
    de: "Wetter",
    fr: "Météo",
  },
  summary: {
    de: "Verwende diese Fähigkeit, wenn jemand nach Wetter, Regen, Schnee, Wind oder Prognosen fragt.",
    fr: "Utilise cette capacité quand on demande la météo, la pluie, la neige, le vent ou une prévision.",
  },
  instructions: {
    de: [
      "Nutze die Wetterdaten von SeniorNett statt zu raten.",
      "Wenn ein Ort fehlt, frage kurz nach oder nimm den im Gespräch genannten Ort.",
      "Nenne keine erfundenen Temperaturen, Mengen oder Zeitverläufe.",
      "Wenn die Antwort die Detailansicht braucht, sprich über Tageswerte und die verfügbaren Zeitverläufe.",
    ],
    fr: [
      "Utilise les données météo de SeniorNett au lieu d'inventer.",
      "Si le lieu manque, demande brièvement ou reprends le lieu mentionné dans la conversation.",
      "N'invente pas de températures, de quantités ou de courbes horaires.",
      "Si la réponse a besoin du détail, parle des valeurs journalières et des courbes disponibles.",
    ],
  },
};

const WEATHER_KEYWORDS = [
  /\b(wetter|wetterbericht|prognose|vorhersage|regen|schnee|wind|temperatur|sonne)\b/i,
  /\b(meteo|météo|pluie|neige|vent|température|prévision)\b/i,
];

const WEATHER_TIME_PATTERNS = [
  /\b(?:in|für|fur)\s+(\d+|einem?|einer?|ein|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn)\s+(?:tag(?:e|en)?|days?)\b/gi,
  /\b(?:in|für|fur)\s+(morgen|heute|heut|tomorrow|today|demain)\b/gi,
];

const WEATHER_NUMBER_WORDS: Record<string, number> = {
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

function normalizeWeatherQueryText(message: string): string {
  let value = message.trim();

  for (const pattern of WEATHER_TIME_PATTERNS) {
    value = value.replace(pattern, " ");
  }

  return value.replace(/\s+/g, " ").trim();
}

export function shouldUseWeatherCapability(message: string): boolean {
  return WEATHER_KEYWORDS.some((pattern) => pattern.test(message));
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
  const normalized = message.toLowerCase();

  if (/\b(morgen|tomorrow|demain|heute|today|aujourd'hui)\b/i.test(normalized)) {
    return 0;
  }

  const numericMatch = normalized.match(/\b(?:in|für|fur)\s+(\d+)\s+(?:tag(?:e|en)?|days?)\b/i);
  if (numericMatch?.[1]) {
    return Math.max(0, Number.parseInt(numericMatch[1], 10));
  }

  for (const [word, value] of Object.entries(WEATHER_NUMBER_WORDS)) {
    const wordPattern = new RegExp(`\\b(?:in|für|fur)\\s+${word}\\s+(?:tag(?:e|en)?|days?)\\b`, "i");
    if (wordPattern.test(message)) {
      return value;
    }
  }

  if (/\b(?:morgen|tomorrow|demain)\b/i.test(message)) {
    return 1;
  }

  return 0;
}

export function buildWeatherCapabilityContext(weather: WeatherResult, language: LottiCapabilityLanguage): string {
  const lines: string[] = [];
  lines.push(language === "fr" ? "Données météo actuelles :" : "Aktuelle Wetterdaten:");
  lines.push(`${language === "fr" ? "Lieu" : "Ort"}: ${weather.city || (language === "fr" ? "inconnu" : "unbekannt")}`);

  if (weather.error) {
    lines.push(`${language === "fr" ? "Erreur" : "Fehler"}: ${weather.error}`);
    return lines.join("\n");
  }

  const days = weather.days.slice(0, 3);
  for (const day of days) {
    const details = [
      `${day.tempMax}° / ${day.tempMin}°`,
      `${day.precipMm > 0 ? `${day.precipMm} mm` : language === "fr" ? "sec" : "trocken"}`,
      day.hourly?.length ? `${language === "fr" ? "courbes horaires" : "Zeitverläufe"}: ${day.hourly.length}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(`- ${day.dayLabel}: ${details}`);
  }

  return lines.join("\n");
}

export function buildWeatherAnswer(weather: WeatherResult, language: LottiCapabilityLanguage, dayIndex = 0): string {
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
    ? (language === "fr" ? "neige possible" : "Schnee möglich")
    : (language === "fr" ? "pas de neige" : "kein Schnee");

  const headline = language === "fr"
    ? `${locationPart}${day.dayLabel}. ${day.tempMax}° / ${day.tempMin}°. ${rainPart}. ${snowPart}.`
    : `${locationPart}${day.dayLabel}. ${day.tempMax}° / ${day.tempMin}°. ${rainPart}. ${snowPart}.`;

  return day.hourly?.length
    ? `${headline} ${language === "fr" ? "Il y a aussi des courbes horaires." : "Es gibt auch Zeitverläufe."}`
    : headline;
}
