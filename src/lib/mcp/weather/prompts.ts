import type { McpLanguage, McpPromptDefinition } from "../types";

export const weatherPrompt: McpPromptDefinition = {
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
  examples: {
    de: [
      "Wie ist das Wetter am Sonntag in Spiez?",
      "Brauche ich heute in Bern einen Regenschirm?",
      "Wie warm wird es morgen in Zürich?",
    ],
    fr: [
      "Quel temps fait-il dimanche à Spiez ?",
      "Ai-je besoin d'un parapluie aujourd'hui à Berne ?",
      "Quelle température fera demain à Zurich ?",
    ],
  },
};

export function buildWeatherRequestPrompt(message: string, history: Array<{ role: "user" | "assistant"; text: string }>, language: McpLanguage): string {
  const isFrench = language === "fr";
  const historyBlock = history
    .slice(-6)
    .map((entry) => `${entry.role === "user" ? (isFrench ? "Utilisateur" : "Nutzer") : "Lotti"}: ${entry.text}`)
    .join("\n");

  return [
    isFrench ? "Tu extrais une requête météo en JSON." : "Du extrahierst eine Wetteranfrage als JSON.",
    isFrench ? "Réponds uniquement en JSON valide et sans texte supplémentaire." : "Antworte nur mit gültigem JSON und ohne zusätzlichen Text.",
    'Schéma: {"ok":true,"location":"...","dayIndex":0,"clarification":null}',
    isFrench
      ? 'Si le lieu manque, réponds avec {"ok":false,"clarification":"..."}'
      : 'Wenn der Ort fehlt, antworte mit {"ok":false,"clarification":"..."}',
    isFrench ? "Utilise l'historique si le lieu a déjà été mentionné." : "Nutze den Verlauf, wenn der Ort schon genannt wurde.",
    `Historique:\n${historyBlock || (isFrench ? "Aucun" : "Keine")}`,
    `Message: ${message}`,
  ].join("\n\n");
}

export function buildWeatherObservationPrompt(
  result: {
    city?: string | null;
    error?: string;
    days: Array<{
      dayLabel: string;
      tempMax: number;
      tempMin: number;
      precipMm: number;
      emoji: string;
    }>;
  },
  language: McpLanguage,
  requestSummary: string
): string {
  return [
    language === "fr"
      ? "Tu reformules un résultat météo en Markdown court et fidèle."
      : "Du formulierst ein Wetterergebnis als kurzes, treues Markdown.",
    language === "fr" ? 'Réponds uniquement en JSON valide: {"summary":"..."}' : 'Antworte nur als gültiges JSON: {"summary":"..."}',
    language === "fr" ? "N'invente rien et garde les valeurs exactes." : "Erfinde nichts und behalte die Werte exakt bei.",
    language === "fr" ? "Utilise des titres, des puces, du gras et du code inline si utile. Pas de liens." : "Nutze Überschriften, Listen, Fett und Inline-Code wenn sinnvoll. Keine Links.",
    `Données:\n${JSON.stringify({ requestSummary, result })}`,
  ].join("\n\n");
}
