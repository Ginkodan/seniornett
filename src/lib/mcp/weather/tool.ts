import type { WeatherResult } from "@/app/actions/weather";
import { fetchWeatherAction } from "@/app/actions/weather";

import { inferStructuredJson } from "../structured-json";
import type {
  ChatHistoryEntry,
  McpLanguage,
  McpTool,
  McpToolObservation,
  McpToolRequestResolution,
  McpToolContext,
} from "../types";
import {
  buildWeatherAnswer,
  buildWeatherClarification,
  buildWeatherContext,
  buildWeatherRequestSummary,
  extractDayIndexFromSummary,
  extractWeatherDayIndex,
  resolveWeatherLocation,
  shouldUseWeatherTool,
} from "./resources";
import { buildWeatherObservationPrompt, buildWeatherRequestPrompt, weatherPrompt } from "./prompts";
import { z } from "zod";

type WeatherToolInput = {
  location: string;
  dayIndex: number;
};

const WeatherRequestSchema = z.object({
  ok: z.boolean(),
  location: z.string().trim().min(1).nullable().optional(),
  dayIndex: z.coerce.number().int().min(0).catch(0),
  clarification: z.string().trim().nullable().optional(),
}).strict();

const WeatherObservationSchema = z.object({
  summary: z.string().trim().min(1),
}).strict();

export function shouldUseWeatherCapability(message: string): boolean {
  return shouldUseWeatherTool(message);
}

async function buildWeatherRequestViaModel(
  message: string,
  history: ChatHistoryEntry[],
  language: McpLanguage
): Promise<McpToolRequestResolution<WeatherToolInput> | null> {
  const prompt = buildWeatherRequestPrompt(message, history, language);
  const result = await inferStructuredJson(prompt, WeatherRequestSchema, {
    generation_options: {
      max_new_tokens: 256,
      temperature: 0.2,
      top_p: 1,
    },
  });

  if (!result.value) {
    return null;
  }

  if (result.value.ok === false) {
    return {
      ok: false,
      clarification: result.value.clarification?.trim() || buildWeatherClarification(language),
    };
  }

  if (!result.value.location) {
    return null;
  }

  return {
    ok: true,
    args: {
      location: result.value.location.trim(),
      dayIndex: result.value.dayIndex,
    },
    requestSummary: buildWeatherRequestSummary(result.value.location.trim(), result.value.dayIndex, language),
  };
}

function buildWeatherObservation(result: WeatherResult, language: McpLanguage, requestSummary: string): McpToolObservation {
  const dayIndex = extractDayIndexFromSummary(requestSummary);
  const headline = buildWeatherAnswer(result, language, dayIndex);
  const context = buildWeatherContext(result, language);

  return {
    toolName: weatherPrompt.toolName,
    requestSummary,
    resultSummary: `${headline}\n${context}`,
    payload: JSON.stringify({
      city: result.city ?? null,
      error: result.error ?? null,
      dayIndex,
      days: result.days.map((day) => ({
        dayLabel: day.dayLabel,
        tempMax: day.tempMax,
        tempMin: day.tempMin,
        precipMm: day.precipMm,
        emoji: day.emoji,
      })),
    }),
    status: result.error ? "error" : "ok",
  };
}

export const weatherTool: McpTool<WeatherToolInput, WeatherResult> = {
  id: weatherPrompt.id,
  toolName: weatherPrompt.toolName,
  title: weatherPrompt.title,
  summary: weatherPrompt.summary,
  instructions: weatherPrompt.instructions,
  examples: weatherPrompt.examples,
  responseInstructions: weatherPrompt.responseInstructions,
  replyMode: weatherPrompt.replyMode,
  sdk: {
    description: weatherPrompt.summary.de,
    inputSchema: {
      location: z.string().trim().min(1).describe("Ort für die Wetterabfrage"),
      dayIndex: z.number().int().min(0).max(6).default(0).describe("0 für heute, 1 für morgen usw."),
    },
    annotations: {
      title: weatherPrompt.title.de,
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  canHandle(context: McpToolContext): boolean {
    return shouldUseWeatherCapability(context.message);
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<WeatherToolInput>> {
    const { message, history, language } = context;
    const modelRequest = await buildWeatherRequestViaModel(message, history, language);
    if (modelRequest) {
      return modelRequest;
    }

    const location = resolveWeatherLocation(message, history);
    if (!location) {
      return {
        ok: false,
        clarification: buildWeatherClarification(language),
      };
    }

    const dayIndex = extractWeatherDayIndex(message);
    return {
      ok: true,
      args: {
        location,
        dayIndex,
      },
      requestSummary: buildWeatherRequestSummary(location, dayIndex, language),
    };
  },
  async execute(args: WeatherToolInput, language: McpLanguage): Promise<WeatherResult> {
    return await fetchWeatherAction(args.location, language, undefined, { includeHourly: false });
  },
  async renderObservation(result: WeatherResult, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    const deterministic = buildWeatherObservation(result, language, requestSummary);
    const prompt = buildWeatherObservationPrompt(result, language, requestSummary);
    const modelResult = await inferStructuredJson(prompt, WeatherObservationSchema, {
      generation_options: {
        max_new_tokens: 128,
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
