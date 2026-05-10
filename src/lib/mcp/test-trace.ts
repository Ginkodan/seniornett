import type { McpToolObservation, McpToolPlan } from "./types";

export type McpTestTraceEvent =
  | { type: "conversation-start"; message: string }
  | { type: "plan"; plan: McpToolPlan }
  | {
      type: "planner-debug";
      source: "planner" | "deterministic-fallback";
      selectedTool: string;
      candidates: Array<{
        toolName: string;
        canHandle: boolean;
        alreadyObserved: boolean;
        requires: string[];
      }>;
      dependencyRewrite?: {
        fromTool: string;
        toTool: string;
      };
    }
  | { type: "request"; toolName: string; requestSummary: string; args: unknown }
  | { type: "observation"; observation: McpToolObservation }
  | { type: "error"; toolName: string; requestSummary: string; resultSummary: string };

const events: McpTestTraceEvent[] = [];

export function isMcpTestTraceEnabled(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

export function resetMcpTestTrace(): void {
  if (!isMcpTestTraceEnabled()) return;
  events.length = 0;
}

export function recordMcpTestTrace(event: McpTestTraceEvent): void {
  if (!isMcpTestTraceEnabled()) return;
  events.push(event);
}

export function getMcpTestTrace(): McpTestTraceEvent[] {
  if (!isMcpTestTraceEnabled()) return [];
  return [...events];
}
