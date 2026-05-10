import { z } from "zod";

import type {
  ChatHistoryEntry,
  McpLanguage,
  McpTool,
  McpToolObservation,
  McpToolRequestResolution,
} from "../types";
import { inferStructuredJson } from "../structured-json";
import { buildDateTimeAnswer, shouldUseDateTimeTool } from "./resources";
import { buildDateTimeObservationPrompt, dateTimePrompt } from "./prompts";

type DateTimeToolInput = Record<string, never>;
type DateTimeToolRaw = {
  nowIso: string;
};

const DateTimeRequestSchema = z.object({}).strict();
const DateTimeObservationSchema = z.object({
  summary: z.string().trim().min(1),
}).strict();

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
  canHandle(message: string, _history: ChatHistoryEntry[], _language: McpLanguage, trace: McpToolObservation[]): boolean {
    return trace.length === 0 && shouldUseDateTimeCapability(message);
  },
  async buildRequest(_message: string, _history: ChatHistoryEntry[], language: McpLanguage): Promise<McpToolRequestResolution<DateTimeToolInput>> {
    DateTimeRequestSchema.parse({});
    return {
      ok: true,
      args: {},
      requestSummary: buildDateTimeRequestSummary(language),
    };
  },
  async execute(_args: DateTimeToolInput): Promise<DateTimeToolRaw> {
    void _args;
    return { nowIso: new Date().toISOString() };
  },
  async renderObservation(result: DateTimeToolRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    const deterministic = buildDateTimeObservation(result, language, requestSummary);
    const prompt = buildDateTimeObservationPrompt(result, language, requestSummary);
    const modelResult = await inferStructuredJson(prompt, DateTimeObservationSchema, {
      generation_options: {
        max_new_tokens: 96,
        temperature: 0.2,
        top_p: 1,
      },
    });

    return {
      ...deterministic,
      resultSummary: modelResult.value?.summary || deterministic.resultSummary,
    };
  },
};
