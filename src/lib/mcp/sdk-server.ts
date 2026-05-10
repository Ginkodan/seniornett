import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MCP_TOOLS } from "./registry";
import type { McpLanguage, McpToolContext, McpToolLike, McpToolObservation } from "./types";

function parsePayload(payload?: string): Record<string, unknown> | undefined {
  if (!payload) return undefined;

  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...(parsed as Record<string, unknown>) } : undefined;
  } catch {
    return undefined;
  }
}

function readLanguage(args: unknown): McpLanguage {
  if (args && typeof args === "object" && "language" in args) {
    return (args as { language?: unknown }).language === "fr" ? "fr" : "de";
  }

  return "de";
}

function buildSdkContext(language: McpLanguage): McpToolContext {
  return {
    message: "",
    history: [],
    language,
    trace: [],
  };
}

async function executeToolForSdk(tool: McpToolLike, args: unknown): Promise<CallToolResult> {
  const language = readLanguage(args);
  const context = buildSdkContext(language);
  const result = await tool.execute(args, language, context);
  const observation: McpToolObservation = await tool.renderObservation(result, language, tool.title[language], context);
  const structuredContent = parsePayload(observation.payload);

  return {
    content: [{ type: "text", text: observation.resultSummary }],
    structuredContent,
    isError: observation.status === "error",
  };
}

export function registerSeniornettMcpTools(server: McpServer, tools: ReadonlyArray<McpToolLike> = MCP_TOOLS): McpServer {
  for (const tool of tools) {
    server.registerTool(
      tool.toolName,
      {
        title: tool.title.de,
        description: tool.sdk.description,
        inputSchema: tool.sdk.inputSchema ?? {},
        outputSchema: tool.sdk.outputSchema,
        annotations: tool.sdk.annotations,
      },
      async (args) => executeToolForSdk(tool, args)
    );
  }

  return server;
}

export function createSeniornettMcpServer(tools: ReadonlyArray<McpToolLike> = MCP_TOOLS): McpServer {
  const server = new McpServer(
    {
      name: "seniornett-mcp",
      version: "0.1.0",
    },
    {
      instructions: [
        "SeniorNett MCP tools are independent read-only capabilities.",
        "Do not call one tool from inside another tool.",
        "A host or orchestrator may pass structuredContent from one tool as arguments to a later tool.",
      ].join(" "),
    }
  );

  return registerSeniornettMcpTools(server, tools);
}
