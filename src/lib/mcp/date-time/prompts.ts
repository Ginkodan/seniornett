import type { McpLanguage, McpPromptDefinition } from "../types";

export const dateTimePrompt: McpPromptDefinition = {
  id: "date-time",
  toolName: "datetime",
  title: {
    de: "Datum & Uhrzeit",
    fr: "Date & heure",
  },
  summary: {
    de: "Verwende diese Fähigkeit für Fragen nach Datum, Wochentag oder Uhrzeit.",
    fr: "Utilise cette capacité pour les questions sur la date, le jour ou l'heure.",
  },
  instructions: {
    de: [
      "Nutze die aktuelle Systemzeit statt zu raten.",
      "Antworte kurz und klar.",
      "Nenne Datum und Uhrzeit in der Sprache des Gesprächs.",
    ],
    fr: [
      "Utilise l'heure système actuelle au lieu d'inventer.",
      "Réponds brièvement et clairement.",
      "Donne la date et l'heure dans la langue de la conversation.",
    ],
  },
};

export function buildDateTimeObservationPrompt(
  raw: { nowIso: string },
  language: McpLanguage,
  requestSummary: string
): string {
  return [
    language === "fr"
      ? "Tu reformules l'heure actuelle en Markdown court et fidèle."
      : "Du formulierst die aktuelle Zeit als kurzes, treues Markdown.",
    language === "fr" ? 'Réponds uniquement en JSON valide: {"summary":"..."}' : 'Antworte nur als gültiges JSON: {"summary":"..."}',
    language === "fr" ? "N'invente rien et garde la date et l'heure exactes." : "Erfinde nichts und behalte Datum und Uhrzeit exakt bei.",
    language === "fr" ? "Utilise un titre et des puces, pas de liens." : "Nutze einen Titel und Stichpunkte, keine Links.",
    `Données:\n${JSON.stringify({ requestSummary, nowIso: raw.nowIso })}`,
  ].join("\n\n");
}
