import { getZurichDateTimeParts } from "@/lib/date-utils";
import type { SearchResult } from "@/lib/sbb";
import { z } from "zod";

import type {
  McpLanguage,
  McpTool,
  McpToolContext,
  McpToolObservation,
  McpToolRequestResolution,
} from "../types";
import {
  buildTimetableDetailedAnswer,
  buildTimetableClarification,
  buildTimetableRequestSummary,
  extractTimetableContext,
  pickBestTimetableConnection,
  shouldUseTimetableTool,
} from "./resources";
import { timetablePrompt } from "./prompts";

const TIMETABLE_LOOKUP_TIMEOUT_MS = 8000;
const RELATIVE_NOW_PATTERNS = /\b(?:jetzt|now|maintenant|nächste\s+(?:verbindung|zug|fahrt)|naechste\s+(?:verbindung|zug|fahrt)|nächster\s+zug|naechster\s+zug|next\s+(?:connection|train|departure)|first\s+available)\b/i;

type TimetableToolInput = {
  from: string;
  to: string;
  date: string;
  time: string;
  isArrival: boolean;
};

type TimetableToolRaw = {
  request: TimetableToolInput;
  result: SearchResult;
};

export function shouldUseTimetableCapability(message: string): boolean {
  return shouldUseTimetableTool(message);
}

async function withTimetableTimeout<T>(operation: Promise<T>): Promise<T> {
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timetable lookup timed out"));
      }, TIMETABLE_LOOKUP_TIMEOUT_MS);
    }),
  ]);
}

function readDateTimeObservation(context: McpToolContext): { dateIso: string; time24: string } | null {
  const observation = [...context.trace].reverse().find((entry) => entry.toolName === "date_time" && entry.status === "ok" && entry.payload);
  if (!observation?.payload) {
    return null;
  }

  try {
    const payload = JSON.parse(observation.payload) as { nowIso?: unknown };
    if (typeof payload.nowIso !== "string") {
      return null;
    }

    return getZurichDateTimeParts(new Date(payload.nowIso));
  } catch {
    return null;
  }
}

function buildTimetableObservation(raw: TimetableToolRaw, language: McpLanguage, requestSummary: string): McpToolObservation {
  const { result, request } = raw;

  if (result.error) {
    return {
      toolName: timetablePrompt.toolName,
      requestSummary,
      resultSummary: buildTimetableDetailedAnswer(
        {
          result,
          request,
        },
        language
      ),
      status: "error",
    };
  }

  const connection = pickBestTimetableConnection(result, request);
  if (!connection) {
    return {
      toolName: timetablePrompt.toolName,
      requestSummary,
      resultSummary: buildTimetableDetailedAnswer(
        {
          result,
          request,
        },
        language
      ),
      status: "ok",
    };
  }

  return {
    toolName: timetablePrompt.toolName,
    requestSummary,
    resultSummary: buildTimetableDetailedAnswer(
      {
        result,
        request,
      },
      language
    ),
    payload: JSON.stringify({
      from: result.from,
      to: result.to,
      requestedDate: request.date,
      requestedTime: request.time,
      requestedDeparture: request.isArrival ? null : request.time,
      departure: connection.departure,
      departurePlatform: connection.platform ?? null,
      arrival: connection.arrival,
      duration: connection.duration,
      changes: connection.changes,
      legs: connection.legs.map((leg) => ({
        number: leg.number,
        category: leg.category,
        direction: leg.direction ?? null,
        departureStation: leg.departureStation,
        departureTime: leg.departurePrognosisTime || leg.departureTime,
        departurePlatform: leg.departurePlatform ?? null,
        arrivalStation: leg.arrivalStation,
        arrivalTime: leg.arrivalPrognosisTime || leg.arrivalTime,
        arrivalPlatform: leg.arrivalPlatform ?? null,
      })),
      transferAssessments: connection.transferAssessments ?? [],
      accessAssessment: connection.accessAssessment ?? null,
      destinationAssessment: connection.destinationAssessment ?? null,
    }),
    status: "ok",
  };
}

export const timetableTool: McpTool<TimetableToolInput, TimetableToolRaw> = {
  id: timetablePrompt.id,
  toolName: timetablePrompt.toolName,
  title: timetablePrompt.title,
  summary: timetablePrompt.summary,
  instructions: timetablePrompt.instructions,
  examples: timetablePrompt.examples,
  responseInstructions: timetablePrompt.responseInstructions,
  replyMode: timetablePrompt.replyMode,
  sdk: {
    description: timetablePrompt.summary.de,
    inputSchema: {
      from: z.string().trim().min(1).describe("Start-Haltestelle oder Adresse"),
      to: z.string().trim().min(1).describe("Ziel-Haltestelle oder Adresse"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Datum im Format YYYY-MM-DD"),
      time: z.string().regex(/^\d{2}:\d{2}$/).describe("Zeit im Format HH:mm"),
      isArrival: z.boolean().default(false).describe("true, wenn die Zeit eine Ankunftszeit ist"),
    },
    annotations: {
      title: timetablePrompt.title.de,
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  canHandle(context: McpToolContext): boolean {
    return shouldUseTimetableCapability(context.message);
  },
  requires(context: McpToolContext): string[] {
    if (!shouldUseTimetableCapability(context.message)) {
      return [];
    }

    const timetableContext = extractTimetableContext(context.message, context.history);
    const hasDateTime = context.trace.some((entry) => entry.toolName === "date_time" && entry.status === "ok");
    if ((!timetableContext.date || !timetableContext.time) && RELATIVE_NOW_PATTERNS.test(context.message) && !hasDateTime) {
      return ["date_time"];
    }

    return [];
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<TimetableToolInput>> {
    const timetableContext = extractTimetableContext(context.message, context.history);
    const nowParts = readDateTimeObservation(context);

    const date = timetableContext.date || (RELATIVE_NOW_PATTERNS.test(context.message) ? nowParts?.dateIso : null);
    const time = timetableContext.time || (RELATIVE_NOW_PATTERNS.test(context.message) ? nowParts?.time24 : null);

    if (timetableContext.missing.length > 0 || !timetableContext.from || !timetableContext.to || !date || !time) {
      const missing = [...timetableContext.missing];
      if (!date && !missing.includes("date")) missing.push("date");
      if (!time && !missing.includes("time")) missing.push("time");
      return {
        ok: false,
        clarification: buildTimetableClarification(context.language, missing),
      };
    }

    return {
      ok: true,
      args: {
        from: timetableContext.from,
        to: timetableContext.to,
        date,
        time,
        isArrival: timetableContext.isArrival,
      },
      requestSummary: buildTimetableRequestSummary(
        {
          from: timetableContext.from,
          to: timetableContext.to,
          date,
          time,
        },
        context.language
      ),
    };
  },
  async execute(args: TimetableToolInput): Promise<TimetableToolRaw> {
    const { searchConnections } = await import("@/lib/sbb");
    const result = await withTimetableTimeout(searchConnections(args.from, args.to, args.date, args.time, args.isArrival, 1, true, 8));
    return { request: args, result };
  },
  async renderObservation(result: TimetableToolRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    return buildTimetableObservation(result, language, requestSummary);
  },
};
