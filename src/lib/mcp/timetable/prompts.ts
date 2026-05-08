import type { McpLanguage, McpPromptDefinition } from "../types";

export const timetablePrompt: McpPromptDefinition = {
  id: "timetable",
  toolName: "timetable",
  title: {
    de: "Fahrplan",
    fr: "Horaire",
  },
  summary: {
    de: "Verwende diese Fähigkeit für Verbindungen, Abfahrten, Ankünfte und Fahrpläne.",
    fr: "Utilise cette capacité pour les correspondances, départs, arrivées et horaires.",
  },
  instructions: {
    de: [
      "Nutze die vorhandene Fahrplan-Implementierung von SeniorNett.",
      "Zeige nur die beste gefundene Verbindung.",
      "Wenn Start, Ziel, Datum oder Uhrzeit fehlen, frage kurz danach.",
      "Erfinde keine Verbindungen.",
    ],
    fr: [
      "Utilise l'implémentation d'horaire déjà présente dans SeniorNett.",
      "N'affiche que la meilleure correspondance trouvée.",
      "Si le départ, l'arrivée, la date ou l'heure manquent, demande brièvement.",
      "N'invente pas de correspondances.",
    ],
  },
};

export function buildTimetableRequestPrompt(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  language: McpLanguage,
  trace: Array<{ toolName: string; status: string; resultSummary: string }>
): string {
  const isFrench = language === "fr";
  const historyBlock = history
    .slice(-6)
    .map((entry) => `${entry.role === "user" ? (isFrench ? "Utilisateur" : "Nutzer") : "Lotti"}: ${entry.text}`)
    .join("\n");
  const traceBlock = trace.length
    ? trace.map((entry, index) => `#${index + 1} ${entry.toolName} [${entry.status}]: ${entry.resultSummary}`).join("\n")
    : isFrench ? "Aucun" : "Keine";

  return [
    isFrench ? "Tu extraits une requête d'horaire au format JSON." : "Du extrahierst eine Fahrplananfrage als JSON.",
    isFrench ? "Réponds uniquement en JSON valide et sans texte supplémentaire." : "Antworte nur mit gültigem JSON und ohne zusätzlichen Text.",
    'Schéma: {"ok":true,"from":"...","to":"...","date":"YYYY-MM-DD","time":"HH:MM","isArrival":false,"clarification":null}',
    isFrench
      ? 'Si une information manque, réponds avec {"ok":false,"clarification":"..."}'
      : 'Wenn Informationen fehlen, antworte mit {"ok":false,"clarification":"..."}',
    isFrench ? "Utilise l'historique si le départ ou la destination ont déjà été donnés." : "Nutze den Verlauf, wenn Start oder Ziel schon genannt wurden.",
    isFrench ? "Garde les lieux tels qu'ils apparaissent dans la conversation." : "Behalte Ortsnamen so bei, wie sie in der Unterhaltung erscheinen.",
    `Historique:\n${historyBlock || (isFrench ? "Aucun" : "Keine")}`,
    `Bisherige Werkzeugbeobachtungen:\n${traceBlock}`,
    `Message: ${message}`,
  ].join("\n\n");
}

export function buildTimetableObservationPrompt(
  raw: { result: { from: string; to: string; error?: string | null; connections: Array<{ departure: string; arrival: string; duration: string; changes: number; platform?: string | null }>; }; request: { from: string; to: string; date: string; time: string; isArrival: boolean } },
  language: McpLanguage,
  requestSummary: string
): string {
  const connection = raw.result.connections[0] ?? null;
  const payload = connection
    ? {
        from: raw.result.from,
        to: raw.result.to,
        departure: connection.departure,
        arrival: connection.arrival,
        duration: connection.duration,
        changes: connection.changes,
        platform: connection.platform ?? null,
      }
    : null;

  return [
    language === "fr"
      ? "Tu reformules un résultat d'horaire en une phrase courte et fidèle."
      : "Du formulierst ein Fahrplanergebnis als kurzen, treuen Satz um.",
    language === "fr" ? 'Réponds uniquement en JSON valide: {"summary":"..." }' : 'Antworte nur als gültiges JSON: {"summary":"..."}.',
    language === "fr" ? "N'invente rien et garde les heures, lieux et quais exacts." : "Erfinde nichts und behalte Zeiten, Orte und Gleise exakt bei.",
    `Mise en page / Layout:\n${JSON.stringify({
      requestSummary,
      payload,
      error: raw.result.error ?? null,
    })}`,
  ].join("\n\n");
}
