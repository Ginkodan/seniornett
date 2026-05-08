import type { z } from "zod";

export type McpLanguage = "de" | "fr";

export type ChatHistoryEntry = {
  role: "user" | "assistant";
  text: string;
};

export type McpToolName = string;

export type McpToolStatus = "ok" | "needs_user_input" | "error";

export interface McpToolObservation {
  toolName: McpToolName;
  requestSummary: string;
  resultSummary: string;
  status: McpToolStatus;
  payload?: string;
}

export interface McpToolRequest<TArgs> {
  ok: true;
  args: TArgs;
  requestSummary: string;
}

export interface McpToolClarification {
  ok: false;
  clarification: string;
}

export type McpToolRequestResolution<TArgs> = McpToolRequest<TArgs> | McpToolClarification;

export interface McpTool<TArgs = unknown, TRaw = unknown> {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
  buildRequest: (
    message: string,
    history: ChatHistoryEntry[],
    language: McpLanguage,
    trace: McpToolObservation[]
  ) => Promise<McpToolRequestResolution<TArgs>>;
  execute: (args: TArgs, language: McpLanguage) => Promise<TRaw>;
  renderObservation: (result: TRaw, language: McpLanguage, requestSummary: string) => Promise<McpToolObservation>;
}

export interface McpToolLike {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
  buildRequest: (
    message: string,
    history: ChatHistoryEntry[],
    language: McpLanguage,
    trace: McpToolObservation[]
  ) => Promise<McpToolRequestResolution<unknown>>;
  execute: (args: unknown, language: McpLanguage) => Promise<unknown>;
  renderObservation: (result: unknown, language: McpLanguage, requestSummary: string) => Promise<McpToolObservation>;
}

export interface McpPromptDefinition {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
}

export interface McpToolPlan {
  tool: McpToolName | "none";
  reason?: string;
}

export interface McpConversationInput {
  message: string;
  history: ChatHistoryEntry[];
  language: McpLanguage;
  systemPrompt: string;
  userLabel: string;
  assistantLabel: string;
  toolCatalogPrompt: string;
  tools: ReadonlyArray<McpToolLike>;
  maxToolUses?: number;
}

export interface McpConversationResult {
  text: string;
  trace: McpToolObservation[];
  plan: McpToolPlan[];
}

export type StructuredInferenceResult<TSchema extends z.ZodTypeAny> = {
  value: z.infer<TSchema> | null;
  text: string;
};
