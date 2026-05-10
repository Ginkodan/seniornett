import { describe, expect, test } from "vitest";

import { askCompanionMessage } from "@/lib/chat/assistant";
import { getMcpTestTrace, resetMcpTestTrace, type ChatHistoryEntry, type McpTestTraceEvent } from "@/lib/mcp";

type WebSearchTraceCase = {
  query: string;
  expectedIntent: string;
  needsLocation?: boolean;
};

const DEFAULT_CASES: WebSearchTraceCase[] = [
  { query: "Welche Migros ist gerade am nächsten zu mir offen?", expectedIntent: "opening_hours", needsLocation: true },
  { query: "Welche Notfallapotheke ist heute Nacht in der Nähe offen?", expectedIntent: "emergency_pharmacy", needsLocation: true },
  { query: "Wo finde ich eine Bäckerei in Spiez, die am Sonntag offen hat?", expectedIntent: "opening_hours" },
  { query: "Wo kann ich in Spiez lactosefreie Milch kaufen?", expectedIntent: "product" },
  { query: "Wo bekomme ich Batterien für ein Hörgerät in der Nähe?", expectedIntent: "product", needsLocation: true },
  { query: "Wo ist das nächste Museum in Spiez?", expectedIntent: "venue" },
  { query: "Wo ist das Stadttheater in Bern?", expectedIntent: "venue" },
  { query: "Gib mir das Programm vom Stadttheater Bern", expectedIntent: "venue" },
  { query: "Finde mir ein Opernhaus in Zürich", expectedIntent: "venue" },
  { query: "Welche Konzerte gibt es diese Woche in Thun?", expectedIntent: "venue" },
  { query: "Wann ist die nächste Kehrichtabfuhr an der Breitfeldstrasse in Bern?", expectedIntent: "local" },
  { query: "Erkläre mir kurz, was eine Patientenverfügung in der Schweiz ist", expectedIntent: "topic" },
  { query: "Finde Infos zur AHV-Rente 2026 in der Schweiz", expectedIntent: "topic" },
];

function readCases(): WebSearchTraceCase[] {
  const rawJson = process.env.WEB_SEARCH_QUERIES_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => typeof entry === "string"
            ? { query: entry.trim(), expectedIntent: "topic" }
            : {
                query: String((entry as Partial<WebSearchTraceCase>).query || "").trim(),
                expectedIntent: String((entry as Partial<WebSearchTraceCase>).expectedIntent || "topic"),
                needsLocation: Boolean((entry as Partial<WebSearchTraceCase>).needsLocation),
              })
          .filter((entry) => entry.query);
      }
    } catch {
      // Fallback to newline format.
    }
  }

  const rawLines = process.env.WEB_SEARCH_QUERIES;
  if (rawLines) {
    return rawLines.split(/\r?\n/).map((entry) => ({ query: entry.trim(), expectedIntent: "topic" })).filter((entry) => entry.query);
  }

  return DEFAULT_CASES;
}

function readRuntimeLocation() {
  const latitude = Number(process.env.WEB_SEARCH_LATITUDE ?? "46.6885");
  const longitude = Number(process.env.WEB_SEARCH_LONGITUDE ?? "7.6782");
  const accuracy = Number(process.env.WEB_SEARCH_ACCURACY_METERS ?? "35");
  const label = process.env.WEB_SEARCH_LOCATION_LABEL ?? "Spiez, Schweiz";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    location: {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
      label,
    },
  };
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function summarizeTrace(events: McpTestTraceEvent[]): string {
  if (events.length === 0) return "No MCP trace was collected.";

  return events.map((event, index) => {
    if (event.type === "conversation-start") {
      return `${index + 1}. conversation: ${event.message}`;
    }

    if (event.type === "plan") {
      return `${index + 1}. plan: ${event.plan.tool}${event.plan.reason ? ` (${event.plan.reason})` : ""}`;
    }

    if (event.type === "planner-debug") {
      return [
        `${index + 1}. planner-debug: source=${event.source}, selected=${event.selectedTool}`,
        event.dependencyRewrite ? `   dependency-rewrite: ${event.dependencyRewrite.fromTool} -> ${event.dependencyRewrite.toTool}` : null,
        "   candidates:",
        ...event.candidates.map((candidate) =>
          `   - ${candidate.toolName}: canHandle=${candidate.canHandle}, alreadyObserved=${candidate.alreadyObserved}, requires=${candidate.requires.join(",") || "-"}`
        ),
      ].filter(Boolean).join("\n");
    }

    if (event.type === "request") {
      return [
        `${index + 1}. request: ${event.toolName}`,
        `   summary: ${event.requestSummary}`,
        `   args: ${prettyJson(event.args)}`,
      ].join("\n");
    }

    if (event.type === "error") {
      return [
        `${index + 1}. error: ${event.toolName}`,
        `   request: ${event.requestSummary}`,
        `   result: ${event.resultSummary}`,
      ].join("\n");
    }

    return [
      `${index + 1}. observation: ${event.observation.toolName} [${event.observation.status}]`,
      `   request: ${event.observation.requestSummary}`,
      `   result: ${event.observation.resultSummary}`,
      event.observation.payload ? `   payload: ${prettyJson(parsePayload(event.observation.payload))}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n");
}

function getWebSearchRequest(events: McpTestTraceEvent[]) {
  return events.find((event) => event.type === "request" && event.toolName === "web_search");
}

function getWebSearchObservation(events: McpTestTraceEvent[]) {
  return events.find((event) => event.type === "observation" && event.observation.toolName === "web_search");
}

const describeWebSearchTrace = process.env.RUN_WEB_SEARCH_TRACE_TESTS === "true" ? describe : describe.skip;

describeWebSearchTrace("web search query trace", () => {
  test("runs web-search-heavy chat queries and prints tool usage", async () => {
    const cases = readCases();
    const runtime = readRuntimeLocation();

    console.log("--- Web search trace configuration ---");
    console.log(`Queries: ${cases.length}`);
    console.log(`Runtime location: ${prettyJson(runtime ?? "none")}`);

    for (const [index, traceCase] of cases.entries()) {
      resetMcpTestTrace();
      const history: ChatHistoryEntry[] = [];

      console.log(`\n=== Web query #${index + 1} ===`);
      console.log(`User: ${traceCase.query}`);

      try {
        const result = await askCompanionMessage(traceCase.query, history, "de", runtime);
        console.log(`Assistant [${result.source}]:\n${result.text}`);

        history.push({ role: "user", text: traceCase.query });
        history.push({ role: "assistant", text: result.text });
      } catch (error) {
        console.log(`Assistant error: ${error instanceof Error ? error.message : String(error)}`);
      }

      const events = getMcpTestTrace();
      console.log("MCP trace:");
      console.log(summarizeTrace(events));

      const webSearchRequest = getWebSearchRequest(events);
      const webSearchObservation = getWebSearchObservation(events);

      expect(webSearchRequest, `Expected web_search request for "${traceCase.query}"`).toBeTruthy();
      expect(webSearchObservation, `Expected web_search observation for "${traceCase.query}"`).toBeTruthy();

      if (webSearchRequest?.type === "request") {
        expect(webSearchRequest.args).toMatchObject({ intent: traceCase.expectedIntent });
        if (traceCase.needsLocation) {
          const args = webSearchRequest.args as { location?: unknown; resolvedPlace?: unknown };
          expect(Boolean(args.location || args.resolvedPlace), `Expected location context for "${traceCase.query}"`).toBe(true);
        }
      }

      if (webSearchObservation?.type === "observation") {
        expect(webSearchObservation.observation.status).toBe("ok");
      }
    }
  }, 300_000);
});
