import { describe, expect, test } from "vitest";

import {
  getMcpTestTrace,
  resetMcpTestTrace,
  runConversation,
  type McpConversationInput,
  type McpTool,
  type McpToolContext,
  type McpToolName,
  type McpToolLike,
  type McpToolObservation,
  type McpToolPlan,
} from "@/lib/mcp";

function makeObservation(toolName: McpToolName, payload?: Record<string, unknown>): McpToolObservation {
  return {
    toolName,
    requestSummary: `${toolName} request`,
    resultSummary: `${toolName} result`,
    status: "ok",
    payload: payload ? JSON.stringify(payload) : undefined,
  };
}

function hasCoordinateObservation(context: McpToolContext): boolean {
  return context.trace.some((entry) => entry.toolName === "coordinate_to_address" && entry.status === "ok");
}

function readResolvedPlace(context: McpToolContext): string | null {
  const observation = [...context.trace].reverse().find((entry) => entry.toolName === "coordinate_to_address" && entry.payload);
  if (!observation?.payload) return null;

  try {
    const payload = JSON.parse(observation.payload) as { label?: unknown };
    return typeof payload.label === "string" ? payload.label : null;
  } catch {
    return null;
  }
}

const coordinateTool: McpTool<{ latitude: number; longitude: number }, { label: string }> = {
  id: "coordinate-to-address-test",
  toolName: "coordinate_to_address",
  title: { de: "Standort auflösen", fr: "Résoudre la position" },
  summary: { de: "Test", fr: "Test" },
  instructions: { de: [], fr: [] },
  replyMode: "synthesized",
  sdk: { description: "Test" },
  async buildRequest(context) {
    const location = context.runtime?.location;
    if (!location) {
      return { ok: false, clarification: "Für welchen Ort soll ich suchen?" };
    }

    return {
      ok: true,
      args: { latitude: location.latitude, longitude: location.longitude },
      requestSummary: `coords ${location.latitude},${location.longitude}`,
    };
  },
  async execute() {
    return { label: "Bundesplatz, Bern, Schweiz" };
  },
  async renderObservation(result, _language, requestSummary) {
    return {
      ...makeObservation("coordinate_to_address", { label: result.label }),
      requestSummary,
      resultSummary: `Ungefährer Standort: ${result.label}`,
    };
  },
};

const webSearchTool: McpTool<{ query: string; resolvedPlace: string | null }, { query: string; resolvedPlace: string | null }> = {
  id: "web-search-test",
  toolName: "web_search",
  title: { de: "Websuche", fr: "Recherche web" },
  summary: { de: "Test", fr: "Test" },
  instructions: { de: [], fr: [] },
  replyMode: "synthesized",
  sdk: { description: "Test" },
  canHandle(context) {
    return /migros|öffnungszeiten/i.test(context.message);
  },
  requires(context) {
    return context.runtime?.location && !hasCoordinateObservation(context) ? ["coordinate_to_address"] : [];
  },
  async buildRequest(context) {
    const resolvedPlace = readResolvedPlace(context);
    return {
      ok: true,
      args: {
        query: context.message,
        resolvedPlace,
      },
      requestSummary: `search ${context.message} near ${resolvedPlace ?? "unknown"}`,
    };
  },
  async execute(args) {
    return args;
  },
  async renderObservation(result, _language, requestSummary) {
    return {
      ...makeObservation("web_search", result),
      requestSummary,
      resultSummary: `Search used ${result.resolvedPlace ?? "no place"}`,
    };
  },
};

function buildInput(overrides: Partial<McpConversationInput> = {}): McpConversationInput {
  return {
    message: "Migros Öffnungszeiten",
    history: [],
    language: "de",
    systemPrompt: "Test assistant",
    userLabel: "Nutzer",
    assistantLabel: "Lotti",
    tools: [coordinateTool as McpToolLike, webSearchTool as McpToolLike],
    runtime: {
      location: {
        latitude: 46.94797,
        longitude: 7.44745,
        accuracy: 25,
      },
    },
    ...overrides,
  };
}

describe("MCP orchestrator", () => {
  test("uses trace-driven pipeline dependencies before the requested tool", async () => {
    resetMcpTestTrace();

    const plannerResponses: McpToolPlan[] = [
      { tool: "web_search", reason: "local opening hours" },
      { tool: "web_search", reason: "local opening hours" },
      { tool: "none", reason: "done" },
    ];

    const result = await runConversation(
      buildInput(),
      async () => plannerResponses.shift() ?? { tool: "none" },
      async (trace) => `final: ${trace.map((entry) => entry.toolName).join(" -> ")}`
    );

    expect(result.trace.map((entry) => entry.toolName)).toEqual(["coordinate_to_address", "web_search"]);
    expect(result.plan.map((entry) => entry.tool)).toEqual(["coordinate_to_address", "web_search", "none"]);
    expect(result.text).toBe("final: coordinate_to_address -> web_search");

    const events = getMcpTestTrace();
    const requestEvents = events.filter((event) => event.type === "request");
    expect(requestEvents).toHaveLength(2);
    expect(requestEvents[0]).toMatchObject({
      type: "request",
      toolName: "coordinate_to_address",
      args: { latitude: 46.94797, longitude: 7.44745 },
    });
    expect(requestEvents[1]).toMatchObject({
      type: "request",
      toolName: "web_search",
      args: {
        query: "Migros Öffnungszeiten",
        resolvedPlace: "Bundesplatz, Bern, Schweiz",
      },
    });
  });

  test("stops repeated identical tool requests instead of looping", async () => {
    resetMcpTestTrace();

    const repeatedTool: McpTool<{ query: string }, { ok: true }> = {
      id: "repeat-test",
      toolName: "repeat_tool",
      title: { de: "Repeat", fr: "Repeat" },
      summary: { de: "Test", fr: "Test" },
      instructions: { de: [], fr: [] },
      sdk: { description: "Test" },
      async buildRequest() {
        return {
          ok: true,
          args: { query: "same" },
          requestSummary: "same request",
        };
      },
      async execute() {
        return { ok: true };
      },
      async renderObservation(_result, _language, requestSummary) {
        return {
          toolName: "repeat_tool",
          requestSummary,
          resultSummary: "done",
          status: "ok",
          payload: JSON.stringify({ ok: true }),
        };
      },
    };

    const plans: McpToolPlan[] = [
      { tool: "repeat_tool" },
      { tool: "repeat_tool" },
      { tool: "none" },
    ];

    const result = await runConversation(
      buildInput({ tools: [repeatedTool as McpToolLike], runtime: undefined }),
      async () => plans.shift() ?? { tool: "none" },
      async () => "final"
    );

    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]).toMatchObject({ toolName: "repeat_tool", status: "ok" });
    expect(result.trace[1]).toMatchObject({ toolName: "repeat_tool", status: "error" });
    expect(result.trace[1].resultSummary).toContain("denselben Daten");

    const requestEvents = getMcpTestTrace().filter((event) => event.type === "request");
    expect(requestEvents).toHaveLength(1);
  });
});
