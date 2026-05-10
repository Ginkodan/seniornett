"use server";

import { askCompanionMessage } from "@/lib/chat/assistant";
import { normalizeLanguage } from "@/lib/i18n";
import type { McpRuntimeContext } from "@/lib/mcp";

export async function askLottiAction(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }> = [],
  language?: string,
  runtime?: McpRuntimeContext
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

  const result = await askCompanionMessage(trimmedMessage, history, languageKey, runtime);
  return result;
}
