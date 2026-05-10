import type { z } from "zod";

export type McpLanguage = "de" | "fr";

export type ChatHistoryEntry = {
  role: "user" | "assistant";
  text: string;
};

export type McpToolName = string;

export type McpToolStatus = "ok" | "needs_user_input" | "error";

export type McpRuntimeLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  label?: string;
};

export type McpRuntimeContext = {
  location?: McpRuntimeLocation;
};

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

export type McpToolContext = {
  message: string;
  history: ChatHistoryEntry[];
  language: McpLanguage;
  trace: McpToolObservation[];
  runtime?: McpRuntimeContext;
};

export type McpSdkToolMetadata = {
  description: string;
  inputSchema?: z.ZodRawShape;
  outputSchema?: z.ZodRawShape;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
};

export interface McpTool<TArgs = unknown, TRaw = unknown> {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
  examples?: Record<McpLanguage, string[]>;
  responseInstructions?: Record<McpLanguage, string[]>;
  replyMode?: "direct" | "synthesized";
  sdk: McpSdkToolMetadata;
  canHandle?: (context: McpToolContext) => boolean;
  requires?: (context: McpToolContext) => McpToolName[];
  buildRequest: (context: McpToolContext) => Promise<McpToolRequestResolution<TArgs>>;
  execute: (args: TArgs, language: McpLanguage, context: McpToolContext) => Promise<TRaw>;
  renderObservation: (result: TRaw, language: McpLanguage, requestSummary: string, context: McpToolContext) => Promise<McpToolObservation>;
}

export interface McpToolLike {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
  examples?: Record<McpLanguage, string[]>;
  responseInstructions?: Record<McpLanguage, string[]>;
  replyMode?: "direct" | "synthesized";
  sdk: McpSdkToolMetadata;
  canHandle?: (context: McpToolContext) => boolean;
  requires?: (context: McpToolContext) => McpToolName[];
  buildRequest: (context: McpToolContext) => Promise<McpToolRequestResolution<unknown>>;
  execute: (args: unknown, language: McpLanguage, context: McpToolContext) => Promise<unknown>;
  renderObservation: (result: unknown, language: McpLanguage, requestSummary: string, context: McpToolContext) => Promise<McpToolObservation>;
}

export interface McpPromptDefinition {
  id: string;
  toolName: McpToolName;
  title: Record<McpLanguage, string>;
  summary: Record<McpLanguage, string>;
  instructions: Record<McpLanguage, string[]>;
  examples?: Record<McpLanguage, string[]>;
  responseInstructions?: Record<McpLanguage, string[]>;
  replyMode?: "direct" | "synthesized";
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
  toolCatalogPrompt?: string;
  tools: ReadonlyArray<McpToolLike>;
  maxToolUses?: number;
  runtime?: McpRuntimeContext;
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
