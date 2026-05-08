"use server";

import { askCompanionMessage } from "@/lib/chat/assistant";
import { normalizeLanguage } from "@/lib/i18n";
import { extractTimetableContext, timetableTool } from "@/lib/mcp/timetable";

async function tryTimetableLookup(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  languageKey: "de" | "fr"
): Promise<{ ok: boolean; text: string; source: string } | null> {
  const context = extractTimetableContext(message, history);
  if (!context.from || !context.to || !context.date || !context.time) {
    return null;
  }

  const request = await timetableTool.buildRequest(message, history, languageKey, []);
  if (!request.ok) {
    return {
      ok: false,
      text: request.clarification,
      source: "timetable-clarification",
    };
  }

  const raw = await timetableTool.execute(request.args, languageKey);
  const observation = await timetableTool.renderObservation(raw, languageKey, request.requestSummary);
  return {
    ok: true,
    text: observation.resultSummary,
    source: "timetable-direct",
  };
}

export async function askLottiAction(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }> = [],
  language?: string
) {
  const trimmedMessage = (message || "").trim();
  const locale = normalizeLanguage(language);
  const languageKey = locale === "fr" ? "fr" : "de";

  if (!trimmedMessage) {
    return {
      ok: false,
      text: languageKey === "fr" ? "Veuillez d'abord écrire une question à Lotti." : "Schreib bitte zuerst eine Frage an Lotti.",
      source: "validation",
    };
  }

  const timetableReply = await tryTimetableLookup(trimmedMessage, history, languageKey);
  if (timetableReply) {
    return timetableReply;
  }

  const result = await askCompanionMessage(trimmedMessage, history, languageKey);
  return result;
}
