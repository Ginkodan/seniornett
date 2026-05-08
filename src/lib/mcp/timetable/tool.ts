import type { SearchResult } from "@/lib/sbb";

import type {
  ChatHistoryEntry,
  McpLanguage,
  McpTool,
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
  async buildRequest(message: string, history: ChatHistoryEntry[], language: McpLanguage, trace: McpToolObservation[]): Promise<McpToolRequestResolution<TimetableToolInput>> {
    void trace;

    const context = extractTimetableContext(message, history);

    if (context.missing.length > 0 || !context.from || !context.to || !context.date || !context.time) {
      return {
        ok: false,
        clarification: buildTimetableClarification(language, context.missing),
      };
    }

    return {
      ok: true,
      args: {
        from: context.from,
        to: context.to,
        date: context.date,
        time: context.time,
        isArrival: context.isArrival,
      },
      requestSummary: buildTimetableRequestSummary(
        {
          from: context.from,
          to: context.to,
          date: context.date,
          time: context.time,
        },
        language
      ),
    };
  },
  async execute(args: TimetableToolInput): Promise<TimetableToolRaw> {
    const { searchConnections } = await import("@/lib/sbb");
    const result = await withTimetableTimeout(searchConnections(args.from, args.to, args.date, args.time, args.isArrival, 1, true, 8));
    return { request: args, result };
  },
  async renderObservation(result: TimetableToolRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    const deterministic = buildTimetableObservation(result, language, requestSummary);
    return deterministic;
  },
};
