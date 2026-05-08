import { inferText } from "@/lib/inference";

import type {
  McpConversationInput,
  McpConversationResult,
  McpToolLike,
  McpToolObservation,
  McpToolPlan,
} from "./types";

const FINAL_ANSWER_TIMEOUT_MS = 4000;
const MAX_HISTORY_TURNS_FOR_PROMPTS = 6;
const TOOL_PLAN_TIMEOUT_MS = 2500;

function buildHistoryBlock(history: McpConversationInput["history"], userLabel: string, assistantLabel: string): string {
  const turns = history.slice(-MAX_HISTORY_TURNS_FOR_PROMPTS).map((entry) => {
    const label = entry.role === "user" ? userLabel : assistantLabel;
    return `${label}: ${entry.text}`;
  });

  return turns.length > 0 ? `${turns.join("\n")}\n` : "";
}

function buildToolCatalogBlock(tools: ReadonlyArray<McpToolLike>, language: McpConversationInput["language"]): string {
  return tools
    .map((tool) => {
      const instructions = tool.instructions[language].map((line) => `- ${line}`).join("\n");
      return [`${tool.title[language]} (${tool.toolName})`, tool.summary[language], instructions].join("\n");
    })
    .join("\n\n");
}

function buildObservationBlock(trace: McpToolObservation[]): string {
  if (trace.length === 0) {
    return "Keine Werkzeugbeobachtungen bisher.";
  }

  return trace
    .map((entry, index) => {
      const prefix = `#${index + 1} ${entry.toolName} [${entry.status}]`;
      const payload = entry.payload ? `\nPayload: ${entry.payload}` : "";
      return `${prefix}\nInput: ${entry.requestSummary}\nResult: ${entry.resultSummary}${payload}`;
    })
    .join("\n\n");
}

function buildPayloadBlock(trace: McpToolObservation[]): string {
  const payloadEntries = trace.filter((entry) => entry.payload);
  if (payloadEntries.length === 0) {
    return "Keine strukturierten Werkzeugwerte.";
  }

  return payloadEntries.map((entry, index) => `#${index + 1} ${entry.toolName}: ${entry.payload}`).join("\n");
}

export async function runConversation(
  input: McpConversationInput,
  planRequest: (trace: McpToolObservation[]) => Promise<McpToolPlan>,
  finalAnswerRequest: (trace: McpToolObservation[]) => Promise<string>
): Promise<McpConversationResult> {
  const toolMap = new Map<string, McpToolLike>(input.tools.map((tool) => [tool.toolName, tool] as const));
  const trace: McpToolObservation[] = [];
  const plans: McpToolPlan[] = [];
  const maxToolUses = Math.max(1, Math.min(10, input.maxToolUses ?? 10));

  for (let index = 0; index < maxToolUses; index += 1) {
    const plan = await Promise.race([
      planRequest(trace),
      new Promise<McpToolPlan>((_, reject) => {
        setTimeout(() => reject(new Error("Tool planning timed out")), TOOL_PLAN_TIMEOUT_MS);
      }),
    ]);
    plans.push(plan);

    if (plan.tool === "none") {
      break;
    }

    const tool = toolMap.get(plan.tool);
    if (!tool) {
      trace.push({
        toolName: plan.tool,
        requestSummary: plan.reason ? `Planner reason: ${plan.reason}` : "Planner selected an unavailable tool.",
        resultSummary: "The requested tool is not available.",
        status: "error",
      });
      break;
    }

    const request = await tool.buildRequest(input.message, input.history, input.language, trace);
    if (!request.ok) {
      trace.push({
        toolName: tool.toolName,
        requestSummary: "Tool request could not be resolved.",
        resultSummary: request.clarification,
        status: "needs_user_input",
      });
      break;
    }

    const rawResult = await tool.execute(request.args, input.language);
    const observation = await tool.renderObservation(rawResult, input.language, request.requestSummary);
    trace.push(observation);
  }

  const text = await Promise.race([
    finalAnswerRequest(trace),
    new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("Final answer timed out")), FINAL_ANSWER_TIMEOUT_MS);
    }),
  ]).catch(() => "");

  return {
    text,
    trace,
    plan: plans,
  };
}

export function buildConversationContext(input: McpConversationInput, trace: McpToolObservation[]): {
  historyBlock: string;
  toolCatalogBlock: string;
  observationBlock: string;
  payloadBlock: string;
} {
  return {
    historyBlock: buildHistoryBlock(input.history, input.userLabel, input.assistantLabel),
    toolCatalogBlock: buildToolCatalogBlock(input.tools, input.language),
    observationBlock: buildObservationBlock(trace),
    payloadBlock: buildPayloadBlock(trace),
  };
}
