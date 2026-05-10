import { describe, test } from "vitest";

import { askCompanionMessage } from "@/lib/chat/assistant";
import { getMcpTestTrace, resetMcpTestTrace, type ChatHistoryEntry, type McpTestTraceEvent } from "@/lib/mcp";

const DEFAULT_QUERIES = [
  "Finde den Fahrplan jetzt von Spiez nach Zürich",
  "Wie ist das Wetter heute in Bern?",
  "Welches Datum ist heute?",
];

function readQueries(): string[] {
  const rawJson = process.env.CHAT_QUERIES_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to the newline format below.
    }
  }

  const rawLines = process.env.CHAT_QUERIES;
  if (rawLines) {
    return rawLines.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  }

  return DEFAULT_QUERIES;
}

function summarizeTrace(events: McpTestTraceEvent[]): string {
  if (events.length === 0) {
    return "No MCP trace was collected.";
  }

  return events.map((event, index) => {
    if (event.type === "conversation-start") {
      return `${index + 1}. conversation: ${event.message}`;
    }

    if (event.type === "plan") {
      return `${index + 1}. plan: ${event.plan.tool}${event.plan.reason ? ` (${event.plan.reason})` : ""}`;
    }

    if (event.type === "request") {
      return [
        `${index + 1}. request: ${event.toolName}`,
        `   summary: ${event.requestSummary}`,
        `   args: ${JSON.stringify(event.args)}`,
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
      event.observation.payload ? `   payload: ${event.observation.payload}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n");
}

describe("chat query trace", () => {
  test("runs configured chat queries and prints tool usage", async () => {
    const queries = readQueries();
    const history: ChatHistoryEntry[] = [];

    for (const [index, query] of queries.entries()) {
      resetMcpTestTrace();

      console.log(`\n--- Chat query #${index + 1} ---`);
      console.log(`User: ${query}`);

      try {
        const result = await askCompanionMessage(query, history, "de");
        console.log(`Assistant [${result.source}]:\n${result.text}`);

        history.push({ role: "user", text: query });
        history.push({ role: "assistant", text: result.text });
      } catch (error) {
        console.log(`Assistant error: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log("MCP trace:");
      console.log(summarizeTrace(getMcpTestTrace()));
    }
  });
});
