import { dateTimeTool } from "./date-time";
import { timetableTool } from "./timetable";
import { weatherTool } from "./weather";
import type { McpToolLike } from "./types";

import { buildPlannerPromptCatalog, buildPromptCatalog } from "./catalog";

export const MCP_TOOLS = [weatherTool, dateTimeTool, timetableTool] as const as readonly McpToolLike[];

export function buildMcpPromptCatalog(language: "de" | "fr"): string {
  return buildPromptCatalog(MCP_TOOLS, language);
}

export function buildMcpPlannerPromptCatalog(language: "de" | "fr"): string {
  return buildPlannerPromptCatalog(MCP_TOOLS, language);
}
