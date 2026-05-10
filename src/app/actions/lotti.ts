"use server";

import { askCompanionMessage } from "@/lib/chat/assistant";
import { getZurichDateTimeParts } from "@/lib/date-utils";
import { normalizeLanguage } from "@/lib/i18n";
import { dateTimeTool } from "@/lib/mcp/date-time";
import {
  buildTimetableRequestSummary,
  extractTimetableContext,
  timetableTool,
} from "@/lib/mcp/timetable";

const TIMETABLE_NOW_PATTERNS = /\b(?:jetzt|now|maintenant|nächste\s+(?:verbindung|zug|fahrt)|nächster\s+zug|next\s+(?:connection|train|departure)|first\s+available)\b/i;

async function tryTimetableLookup(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  languageKey: "de" | "fr"
): Promise<{ ok: boolean; text: string; source: string } | null> {
  const context = extractTimetableContext(message, history);
  if (!context.from || !context.to) {
    return null;
  }

  let date = context.date;
  let time = context.time;

  if ((!date || !time) && TIMETABLE_NOW_PATTERNS.test(message)) {
    const currentTime = await dateTimeTool.execute({});
    const now = getZurichDateTimeParts(new Date(currentTime.nowIso));
    date = date || now.dateIso;
    time = time || now.time24;
  }

  if (!date || !time) {
    return null;
  }

  const request = {
    from: context.from,
    to: context.to,
    date,
    time,
    isArrival: context.isArrival,
  };
  const requestSummary = buildTimetableRequestSummary(
    {
      from: request.from,
      to: request.to,
      date: request.date,
      time: request.time,
    },
    languageKey
  );

  const raw = await timetableTool.execute(request, languageKey);
  const observation = await timetableTool.renderObservation(raw, languageKey, requestSummary);
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
