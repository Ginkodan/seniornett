import { inferText } from "@/lib/inference";
import { z } from "zod";

import type {
  McpConversationInput,
  McpConversationResult,
  McpToolContext,
  McpToolLike,
  McpToolObservation,
  McpToolPlan,
} from "./types";
import { inferStructuredJson } from "./structured-json";
import { recordMcpTestTrace } from "./test-trace";

const FINAL_ANSWER_TIMEOUT_MS = 12000;
const MAX_HISTORY_TURNS_FOR_PROMPTS = 6;
const TOOL_PLAN_TIMEOUT_MS = 2500;
const DEFAULT_MAX_TOOL_USES = 16;
const HARD_MAX_TOOL_USES = 24;

const ToolPlanSchema = z
  .object({
    tool: z.string().trim().min(1).optional(),
    capability: z.string().trim().min(1).optional(),
    reason: z.string().trim().optional(),
  })
  .strict();

function buildToolContext(input: McpConversationInput, trace: McpToolObservation[]): McpToolContext {
  return {
    message: input.message,
    history: input.history,
    language: input.language,
    trace,
    runtime: input.runtime,
  };
}

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
      const responseInstructions = tool.responseInstructions?.[language]?.length
        ? [
            language === "fr" ? "Règles de réponse:" : "Antwortregeln:",
            ...tool.responseInstructions[language].map((line) => `- ${line}`),
          ].join("\n")
        : "";
      return [`${tool.title[language]} (${tool.toolName})`, tool.summary[language], instructions, responseInstructions]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildPlannerHistoryBlock(history: McpConversationInput["history"], userLabel: string): string {
  const userTurns = history
    .filter((entry) => entry.role === "user")
    .slice(-4)
    .map((entry) => `${userLabel}: ${entry.text}`);

  return userTurns.length > 0 ? `${userTurns.join("\n")}\n` : "";
}

function buildRuntimeBlock(input: McpConversationInput): string {
  const location = input.runtime?.location;
  if (!location) {
    return input.language === "fr" ? "Position navigateur: non disponible." : "Browser-Standort: nicht verfügbar.";
  }

  const parts = [
    `lat=${location.latitude}`,
    `lon=${location.longitude}`,
    location.accuracy ? `accuracy=${Math.round(location.accuracy)}m` : null,
    location.label ? `label=${location.label}` : null,
  ].filter(Boolean);

  return input.language === "fr" ? `Position navigateur: ${parts.join(", ")}.` : `Browser-Standort: ${parts.join(", ")}.`;
}

function buildObservationBlock(trace: McpToolObservation[], language: McpConversationInput["language"]): string {
  if (trace.length === 0) {
    return language === "fr" ? "Aucune observation MCP pour l'instant." : "Keine MCP-Beobachtungen bisher.";
  }

  return trace
    .map((entry, index) => {
      const prefix = `#${index + 1} ${entry.toolName} [${entry.status}]`;
      const payload = entry.payload ? `\nPayload: ${entry.payload}` : "";
      return `${prefix}\nInput: ${entry.requestSummary}\nResult: ${entry.resultSummary}${payload}`;
    })
    .join("\n\n");
}

function buildPayloadBlock(trace: McpToolObservation[], language: McpConversationInput["language"]): string {
  const payloadEntries = trace.filter((entry) => entry.payload);
  if (payloadEntries.length === 0) {
    return language === "fr" ? "Aucune valeur structurée." : "Keine strukturierten Werkzeugwerte.";
  }

  return payloadEntries.map((entry, index) => `#${index + 1} ${entry.toolName}: ${entry.payload}`).join("\n");
}

function hasObservation(trace: McpToolObservation[], toolName: string): boolean {
  return trace.some((entry) => entry.toolName === toolName);
}

function resolvePipelinePlan(
  input: McpConversationInput,
  toolMap: Map<string, McpToolLike>,
  trace: McpToolObservation[],
  plan: McpToolPlan
): { plan: McpToolPlan; dependencyRewrite?: { fromTool: string; toTool: string } } {
  if (plan.tool === "none") {
    return { plan };
  }

  const plannedTool = toolMap.get(plan.tool);
  if (!plannedTool?.requires) {
    return { plan };
  }

  const context = buildToolContext(input, trace);
  const requiredTools = plannedTool.requires(context);
  const nextRequiredTool = requiredTools.find((toolName) => toolMap.has(toolName) && !hasObservation(trace, toolName));

  if (!nextRequiredTool) {
    return { plan };
  }

  return {
    plan: {
      tool: nextRequiredTool,
      reason: input.language === "fr"
        ? `préparation nécessaire avant ${plannedTool.toolName}`
        : `notwendige Vorbereitung vor ${plannedTool.toolName}`,
    },
    dependencyRewrite: {
      fromTool: plannedTool.toolName,
      toTool: nextRequiredTool,
    },
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const primitive = JSON.stringify(value);
    return primitive === undefined ? "undefined" : primitive;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

export async function runConversation(
  input: McpConversationInput,
  planRequest: (trace: McpToolObservation[]) => Promise<McpToolPlan>,
  finalAnswerRequest: (trace: McpToolObservation[]) => Promise<string>
): Promise<McpConversationResult> {
  const toolMap = new Map<string, McpToolLike>(input.tools.map((tool) => [tool.toolName, tool] as const));
  const trace: McpToolObservation[] = [];
  const plans: McpToolPlan[] = [];
  const executedRequestSignatures = new Set<string>();
  const maxToolUses = Math.max(1, Math.min(HARD_MAX_TOOL_USES, input.maxToolUses ?? DEFAULT_MAX_TOOL_USES));

  recordMcpTestTrace({ type: "conversation-start", message: input.message });

  for (let index = 0; index < maxToolUses; index += 1) {
    let plannerSource: "planner" | "deterministic-fallback" = "planner";
    const planned = await Promise.race([
      planRequest(trace),
      new Promise<McpToolPlan>((_, reject) => {
        setTimeout(() => reject(new Error("Tool planning timed out")), TOOL_PLAN_TIMEOUT_MS);
      }),
    ]).catch(() => {
      plannerSource = "deterministic-fallback";
      return requestDeterministicPlan(input, trace);
    });
    const resolvedPlan = resolvePipelinePlan(input, toolMap, trace, planned);
    let plan = resolvedPlan.plan;
    const plannedTool = plan.tool === "none" ? null : toolMap.get(plan.tool);
    const context = buildToolContext(input, trace);
    let canHandleRewrite: { fromTool: string; toTool: string } | undefined;
    if (plannedTool?.canHandle && !plannedTool.canHandle(context)) {
      const deterministic = requestDeterministicPlan(input, trace);
      if (deterministic.tool !== "none") {
        canHandleRewrite = { fromTool: plannedTool.toolName, toTool: deterministic.tool };
        plan = deterministic;
      }
    }
    plans.push(plan);
    recordMcpTestTrace({ type: "plan", plan });
    recordMcpTestTrace({
      type: "planner-debug",
      source: plannerSource,
      selectedTool: plan.tool,
      candidates: buildPlannerCandidates(input, trace),
      dependencyRewrite: resolvedPlan.dependencyRewrite || canHandleRewrite,
    });

    if (plan.tool === "none") {
      break;
    }

    const tool = toolMap.get(plan.tool);
    if (!tool) {
      const observation: McpToolObservation = {
        toolName: plan.tool,
        requestSummary: plan.reason ? `Planner reason: ${plan.reason}` : "Planner selected an unavailable tool.",
        resultSummary: "The requested tool is not available.",
        status: "error",
      };
      trace.push(observation);
      recordMcpTestTrace({ type: "observation", observation });
      break;
    }

    try {
      const context = buildToolContext(input, trace);
      const request = await tool.buildRequest(context);
      if (!request.ok) {
        const observation: McpToolObservation = {
          toolName: tool.toolName,
          requestSummary: input.language === "fr" ? "La requête de l'outil n'a pas pu être résolue." : "Tool request could not be resolved.",
          resultSummary: request.clarification,
          status: "needs_user_input",
        };
        trace.push(observation);
        recordMcpTestTrace({ type: "observation", observation });
        break;
      }

      const requestSignature = `${tool.toolName}:${stableStringify(request.args)}`;
      if (executedRequestSignatures.has(requestSignature)) {
        const observation: McpToolObservation = {
          toolName: tool.toolName,
          requestSummary: request.requestSummary,
          resultSummary: input.language === "fr" ? "Cet outil a déjà été appelé avec les mêmes données." : "Dieses Werkzeug wurde bereits mit denselben Daten aufgerufen.",
          status: "error",
        };
        trace.push(observation);
        recordMcpTestTrace({ type: "observation", observation });
        break;
      }
      executedRequestSignatures.add(requestSignature);

      recordMcpTestTrace({
        type: "request",
        toolName: tool.toolName,
        requestSummary: request.requestSummary,
        args: request.args,
      });

      const executionContext = buildToolContext(input, trace);
      const rawResult = await tool.execute(request.args, input.language, executionContext);
      const observation = await tool.renderObservation(rawResult, input.language, request.requestSummary, executionContext);
      trace.push(observation);
      recordMcpTestTrace({ type: "observation", observation });

      if (observation.status === "needs_user_input") {
        break;
      }
    } catch {
      const observation: McpToolObservation = {
        toolName: tool.toolName,
        requestSummary: plan.reason ? `Planner reason: ${plan.reason}` : tool.title[input.language],
        resultSummary: input.language === "fr" ? "L'outil n'a pas pu être exécuté." : "Das Werkzeug konnte nicht ausgeführt werden.",
        status: "error",
      };
      trace.push(observation);
      recordMcpTestTrace({
        type: "error",
        toolName: observation.toolName,
        requestSummary: observation.requestSummary,
        resultSummary: observation.resultSummary,
      });
      recordMcpTestTrace({ type: "observation", observation });
      break;
    }
  }

  const text = await Promise.race([
    finalAnswerRequest(trace),
    new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("Final answer timed out")), FINAL_ANSWER_TIMEOUT_MS);
    }),
  ]).catch(() => "");
  const fallbackText = [...trace]
    .reverse()
    .find((entry) => (entry.status === "ok" || entry.status === "needs_user_input") && entry.resultSummary.trim())
    ?.resultSummary
    .trim();

  return {
    text: text || fallbackText || "",
    trace,
    plan: plans,
  };
}

function buildToolNameList(tools: ReadonlyArray<McpToolLike>): string {
  return tools.map((tool) => tool.toolName).join("|");
}

export function buildMcpPlannerPrompt(input: McpConversationInput, trace: McpToolObservation[]): string {
  const context = buildConversationContext(input, trace);
  const plannerHistoryBlock = buildPlannerHistoryBlock(input.history, input.userLabel);
  const toolNames = buildToolNameList(input.tools);

  return [
    input.systemPrompt,
    input.language === "fr" ? "Tu es un orchestrateur MCP générique." : "Du bist ein generischer MCP-Orchestrator.",
    input.language === "fr" ? "Choisis exactement une prochaine action." : "Wähle genau eine nächste Aktion.",
    input.language === "fr"
      ? `Les outils disponibles sont: ${toolNames || "aucun"}. Tu peux aussi choisir 'none'.`
      : `Verfügbare Werkzeuge sind: ${toolNames || "keine"}. Du darfst auch 'none' wählen.`,
    input.language === "fr"
      ? "Tu peux utiliser plusieurs outils l'un après l'autre. Choisis seulement le prochain outil utile."
      : "Du darfst mehrere Werkzeuge nacheinander nutzen. Wähle immer nur das nächste sinnvolle Werkzeug.",
    input.language === "fr"
      ? "Réponds uniquement en JSON, sans Markdown ni texte libre."
      : "Antworte ausschliesslich als JSON ohne Markdown oder Fliesstext.",
    input.language === "fr" ? 'Schéma: {"tool":"<tool-name>|none","reason":"court"}' : 'Schema: {"tool":"<tool-name>|none","reason":"kurz"}',
    input.language === "fr"
      ? "Le message actuel est prioritaire; utilise l'historique seulement pour compléter les informations manquantes."
      : "Die aktuelle Nachricht hat Priorität; nutze den Verlauf nur, um fehlende Informationen zu ergänzen.",
    input.language === "fr"
      ? "Utilise les observations structurées existantes comme entrée pour les outils suivants. Les outils ne s'appellent jamais entre eux."
      : "Nutze vorhandene strukturierte Beobachtungen als Eingabe für nachfolgende Werkzeuge. Werkzeuge rufen sich nie gegenseitig auf.",
    input.language === "fr"
      ? "Pour une recherche locale avec coordonnées navigateur, résous d'abord les coordonnées en lieu, puis recherche sur le web."
      : "Bei lokaler Websuche mit Browser-Koordinaten löse zuerst die Koordinaten zu einem Ort auf und suche danach im Web.",
    input.language === "fr"
      ? "Si une demande contient un moment relatif comme maintenant ou aujourd'hui et qu'un autre outil a besoin d'une date ou heure exacte, utilise d'abord un outil capable de fournir le temps actuel."
      : "Wenn eine Anfrage einen relativen Zeitpunkt wie jetzt oder heute enthält und ein anderes Werkzeug ein exaktes Datum oder eine genaue Uhrzeit braucht, nutze zuerst ein Werkzeug für die aktuelle Zeit.",
    input.language === "fr"
      ? "Si une demande n'indique pas explicitement la date ou l'heure mais qu'un outil en aval en a besoin, choisis d'abord l'outil d'heure."
      : "Wenn eine Anfrage kein explizites Datum oder keine Uhrzeit nennt, ein nachgelagertes Werkzeug aber darauf angewiesen ist, wähle zuerst das Zeit-Werkzeug.",
    input.language === "fr"
      ? "Ne répète pas un outil qui a déjà fourni assez d'informations, sauf si un autre outil en dépend clairement ou si la demande actuelle exige une nouvelle recherche."
      : "Wiederhole kein Werkzeug, das bereits genug Informationen geliefert hat, ausser ein anderes Werkzeug hängt klar davon ab oder die aktuelle Anfrage verlangt eine neue Suche.",
    input.toolCatalogPrompt,
    input.language === "fr" ? "Contexte runtime:" : "Runtime-Kontext:",
    buildRuntimeBlock(input),
    input.language === "fr" ? "Historique récent des messages utilisateur:" : "Letzte Nutzer-Nachrichten:",
    plannerHistoryBlock || (input.language === "fr" ? "Aucun" : "Keine"),
    input.language === "fr" ? "Message actuel:" : "Aktuelle Nachricht:",
    `${input.userLabel}: ${input.message}`,
    input.language === "fr" ? "Observations MCP jusqu'ici:" : "Bisherige MCP-Beobachtungen:",
    context.observationBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function requestDeterministicPlan(input: McpConversationInput, trace: McpToolObservation[]): McpToolPlan {
  const attemptedToolNames = new Set(trace.map((entry) => entry.toolName));
  const context = buildToolContext(input, trace);
  const hintedTool = input.tools.find((tool) => {
    if (attemptedToolNames.has(tool.toolName)) {
      return false;
    }

    return tool.canHandle?.(context) ?? false;
  });

  if (hintedTool) {
    return {
      tool: hintedTool.toolName,
      reason: "deterministic tool hint",
    };
  }

  return { tool: "none" };
}

function buildPlannerCandidates(input: McpConversationInput, trace: McpToolObservation[]) {
  const attemptedToolNames = new Set(trace.map((entry) => entry.toolName));
  const context = buildToolContext(input, trace);
  return input.tools.map((tool) => ({
    toolName: tool.toolName,
    canHandle: tool.canHandle?.(context) ?? false,
    alreadyObserved: attemptedToolNames.has(tool.toolName),
    requires: tool.requires?.(context) ?? [],
  }));
}

export async function requestMcpPlan(input: McpConversationInput, trace: McpToolObservation[]): Promise<McpToolPlan> {
  const availableToolNames = new Set(input.tools.map((tool) => tool.toolName));
  const prompt = buildMcpPlannerPrompt(input, trace);

  try {
    const result = (await Promise.race([
      inferStructuredJson(prompt, ToolPlanSchema, {
        generation_options: {
          max_new_tokens: 512,
          temperature: 0.2,
          top_p: 1,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Tool planning timed out")), TOOL_PLAN_TIMEOUT_MS);
      }),
    ])) as { value: z.infer<typeof ToolPlanSchema> | null; text: string };

    const requestedTool = result.value?.tool ?? result.value?.capability;
    if (requestedTool === "none") {
      const deterministic = requestDeterministicPlan(input, trace);
      return deterministic.tool === "none" ? { tool: "none", reason: result.value?.reason } : deterministic;
    }

    if (requestedTool && availableToolNames.has(requestedTool)) {
      return {
        tool: requestedTool,
        reason: result.value?.reason,
      };
    }
  } catch {
    // Fall through to deterministic tool hints when planning is unavailable.
  }

  return requestDeterministicPlan(input, trace);
}

function buildResponseInstructionBlock(tools: ReadonlyArray<McpToolLike>, trace: McpToolObservation[], language: McpConversationInput["language"]): string {
  const usedToolNames = new Set(trace.map((entry) => entry.toolName));
  const lines = tools
    .filter((tool) => usedToolNames.has(tool.toolName))
    .flatMap((tool) => tool.responseInstructions?.[language] ?? []);

  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "";
}

export function buildMcpFinalAnswerPrompt(input: McpConversationInput, trace: McpToolObservation[]): string {
  const context = buildConversationContext(input, trace);
  const responseInstructionBlock = buildResponseInstructionBlock(input.tools, trace, input.language);

  return [
    input.systemPrompt,
    context.toolCatalogBlock,
    input.language === "fr"
      ? "Utilise les résultats MCP suivants pour formuler la réponse."
      : "Nutze die folgenden MCP-Resultate, um die Antwort zu formulieren.",
    input.language === "fr"
      ? "Si un outil demande une clarification, pose exactement une courte question."
      : "Wenn ein Werkzeug eine Klärung verlangt, stelle genau eine kurze Frage.",
    input.language === "fr"
      ? "Si les faits suffisent, réponds de manière amicale, concise et naturelle."
      : "Wenn genug Fakten vorhanden sind, antworte freundlich, knapp und natürlich.",
    input.language === "fr"
      ? "Tu peux utiliser des tableaux Markdown compacts quand plusieurs lignes ou valeurs sont plus faciles à comparer ainsi."
      : "Du darfst kompakte Markdown-Tabellen nutzen, wenn mehrere Zeilen oder Werte so leichter vergleichbar sind.",
    input.language === "fr"
      ? "Utilise les nombres, horaires et lieux exactement tels qu'ils apparaissent dans les observations."
      : "Verwende Zahlen, Zeiten und Orte exakt so, wie sie im Werkzeugverlauf stehen.",
    input.language === "fr"
      ? "Les valeurs structurées sont la source de vérité. N'invente rien."
      : "Die strukturierten Werte sind die Wahrheit. Erfinde keine Fakten.",
    input.language === "fr"
      ? "Mentionne les sources comme noms ou domaines en texte, mais ne crée pas de liens cliquables."
      : "Nenne Quellen als Namen oder Domains im Text, aber erstelle keine klickbaren Links.",
    responseInstructionBlock ? (input.language === "fr" ? "Règles de réponse des outils utilisés:" : "Antwortregeln der verwendeten Werkzeuge:") : "",
    responseInstructionBlock,
    input.language === "fr" ? "Contexte runtime:" : "Runtime-Kontext:",
    buildRuntimeBlock(input),
    input.language === "fr" ? "Observations MCP:" : "MCP-Verlauf:",
    context.observationBlock,
    input.language === "fr" ? "Valeurs structurées obligatoires:" : "Verbindliche strukturierte Werte:",
    context.payloadBlock,
    input.language === "fr" ? "Conversation:" : "Gespräch:",
    `${context.historyBlock}${input.userLabel}: ${input.message}`,
    "",
    `${input.assistantLabel}:`,
  ]
    .filter((line) => line !== "")
    .join("\n\n");
}

export async function requestMcpFinalAnswer(input: McpConversationInput, trace: McpToolObservation[]): Promise<string> {
  const prompt = buildMcpFinalAnswerPrompt(input, trace);

  try {
    const result = await inferText(prompt, {
      generation_options: {
        max_new_tokens: 768,
        temperature: 0.1,
        top_p: 0.7,
      },
    });

    return (result as { text?: string } | null | undefined)?.text?.trim() || "";
  } catch {
    return "";
  }
}

export function formatDeterministicMcpReply(tools: ReadonlyArray<McpToolLike>, trace: McpToolObservation[]): string | null {
  const toolMap = new Map(tools.map((tool) => [tool.toolName, tool] as const));
  const lastStableObservation = trace.at(-1);
  if (!lastStableObservation) {
    return null;
  }

  if (lastStableObservation.status !== "ok" && lastStableObservation.status !== "needs_user_input") {
    return null;
  }

  const tool = toolMap.get(lastStableObservation.toolName);
  if (tool?.replyMode !== "direct" && lastStableObservation.status !== "needs_user_input") {
    return null;
  }

  return lastStableObservation.resultSummary.trim() || null;
}

export async function runMcpConversation(input: McpConversationInput): Promise<McpConversationResult> {
  return await runConversation(
    input,
    (trace) => requestMcpPlan(input, trace),
    (trace) => requestMcpFinalAnswer(input, trace)
  );
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
    observationBlock: buildObservationBlock(trace, input.language),
    payloadBlock: buildPayloadBlock(trace, input.language),
  };
}
