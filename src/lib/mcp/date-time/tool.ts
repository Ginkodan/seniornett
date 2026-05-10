import { z } from "zod";

import type {
  McpLanguage,
  McpTool,
  McpToolContext,
  McpToolObservation,
  McpToolRequestResolution,
} from "../types";
import { buildDateTimeAnswer, shouldUseDateTimeTool } from "./resources";
import { dateTimePrompt } from "./prompts";

type DateTimeToolInput = Record<string, never>;
type DateTimeToolRaw = {
  nowIso: string;
};
const DateTimeRequestSchema = z.object({}).strict();

export function shouldUseDateTimeCapability(message: string): boolean {
  return shouldUseDateTimeTool(message);
}

function buildDateTimeRequestSummary(language: McpLanguage): string {
  return language === "fr" ? "Date et heure actuelles" : "Aktuelles Datum und Uhrzeit";
}

function buildDateTimeObservation(raw: DateTimeToolRaw, language: McpLanguage, requestSummary: string): McpToolObservation {
  const now = new Date(raw.nowIso);
  return {
    toolName: dateTimePrompt.toolName,
    requestSummary,
    resultSummary: buildDateTimeAnswer(language, now),
    payload: JSON.stringify({ nowIso: raw.nowIso }),
    status: "ok",
  };
}

export const dateTimeTool: McpTool<DateTimeToolInput, DateTimeToolRaw> = {
  id: dateTimePrompt.id,
  toolName: dateTimePrompt.toolName,
  title: dateTimePrompt.title,
  summary: dateTimePrompt.summary,
  instructions: dateTimePrompt.instructions,
  examples: dateTimePrompt.examples,
  responseInstructions: dateTimePrompt.responseInstructions,
  replyMode: dateTimePrompt.replyMode,
  sdk: {
    description: dateTimePrompt.summary.de,
    inputSchema: {},
    annotations: {
      title: dateTimePrompt.title.de,
      readOnlyHint: true,
      idempotentHint: false,
    },
  },
  canHandle(context: McpToolContext): boolean {
    return context.trace.length === 0 && shouldUseDateTimeCapability(context.message);
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<DateTimeToolInput>> {
    DateTimeRequestSchema.parse({});
    return {
      ok: true,
      args: {},
      requestSummary: buildDateTimeRequestSummary(context.language),
    };
  },
  async execute(_args: DateTimeToolInput): Promise<DateTimeToolRaw> {
    void _args;
    return { nowIso: new Date().toISOString() };
  },
  async renderObservation(result: DateTimeToolRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    return buildDateTimeObservation(result, language, requestSummary);
  },
};
