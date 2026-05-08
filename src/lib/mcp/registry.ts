import { dateTimePrompt, dateTimeTool } from "./date-time";
import { timetablePrompt, timetableTool } from "./timetable";
import { weatherPrompt, weatherTool } from "./weather";
import type { McpToolLike } from "./types";

import { buildPlannerPromptCatalog, buildPromptCatalog } from "./catalog";

export const MCP_TOOLS = [weatherTool, dateTimeTool, timetableTool] as const as readonly McpToolLike[];

export const MCP_PROMPTS = [weatherPrompt, dateTimePrompt, timetablePrompt] as const;

export function buildMcpPromptCatalog(language: "de" | "fr"): string {
  return buildPromptCatalog(MCP_PROMPTS, language);
}

export function buildMcpPlannerPromptCatalog(language: "de" | "fr"): string {
  return buildPlannerPromptCatalog(MCP_PROMPTS, language);
}
