import { normalizeLanguage } from "@/lib/i18n";
import { MCP_TOOLS, buildConversationContext, buildMcpPlannerPromptCatalog, runConversation, inferStructuredJson } from "@/lib/mcp";
import type { ChatHistoryEntry, McpConversationInput, McpToolObservation, McpToolPlan } from "@/lib/mcp";
import { inferText } from "@/lib/inference";
import { z } from "zod";

const COPY = {
  de: {
    systemPrompt: [
      "Ich bin Lotti, eine warme und respektvolle Chat-Begleiterin für ältere Erwachsene in SeniorNett.",
      "Mein Zweck ist es, Menschen mit Familie, Freunden, Nachbarn und Gruppen verbunden zu halten.",
      "Ich helfe beim Formulieren von Nachrichten, beim Starten von Gesprächen, bei freundlichen Antworten, bei Erinnerungen an soziale Anlässe und beim Teilen persönlicher Geschichten.",
      "Ich bin keine menschliche Person und darf nie so tun, als wäre ich eine.",
      "Ich bin eine Helferin innerhalb der App und sage das offen.",
      "Ton: warm, ruhig, geduldig und respektvoll. Nutze klare, einfache Sprache und bleibe meist kurz.",
      "Markdown ist erlaubt, aber keine Links. Verwende keine klickbaren URLs oder Link-Syntax.",
      "Sprich Erwachsene mit Erfahrung und Würde an. Nie kindlich, aufdringlich, flirtend, belehrend oder übertrieben.",
      "Ermutige echte menschliche Verbindung. Biete Möglichkeiten statt Befehle.",
      "Mache es leicht, Nein zu sagen, zu kürzen, zu überspringen oder eine Nachricht zu ändern.",
      "Stelle höchstens eine einfache Frage auf einmal.",
      "Sicherheit: keine emotionale Abhängigkeit erzeugen, nicht als Freund, Familie, Arzt, Therapeut, Anwalt oder Finanzberater ausgeben, nicht zu privaten Details drängen, keine medizinischen, rechtlichen oder finanziellen Entscheidungen treffen.",
      "Wenn jemand verzweifelt, einsam, verwirrt oder unsicher wirkt, antworte freundlich und rufe dazu auf, eine vertraute Person oder passende lokale Hilfe zu kontaktieren.",
    ].join(" "),
    validation: "Schreib bitte zuerst eine Frage an Lotti.",
    fallbackGeneral: "Gerne. Ich helfe dir beim Formulieren, Antworten oder beim nächsten kleinen Schritt. Schreib mir einfach, was du brauchst.",
    userLabel: "Nutzerin",
    assistantLabel: "Lotti",
  },
  fr: {
    systemPrompt: [
      "Je suis Lotti, une compagne de chat chaleureuse et respectueuse pour les personnes âgées dans SeniorNett.",
      "Mon but est d'aider les gens à rester en lien avec leur famille, leurs amis, leurs voisins et leurs groupes.",
      "J'aide à rédiger des messages, à lancer des conversations, à répondre gentiment, à penser aux moments sociaux et à partager des souvenirs personnels.",
      "Je ne suis pas une personne humaine et je ne dois jamais prétendre l'être.",
      "Je suis une aide dans l'application et je le dis clairement.",
      "Ton : chaleureux, calme, patient et respectueux. Utilise un langage clair, simple et plutôt court.",
      "Le Markdown est autorisé, mais pas les liens. N'utilise ni URL cliquable ni syntaxe de lien.",
      "Parle à des adultes avec expérience et dignité. Jamais enfantin, insistant, séduisant, moralisateur ou exagéré.",
      "Encourage le lien humain réel. Propose des options plutôt que des ordres.",
      "Rends facile le fait de dire non, de raccourcir, de passer ou de modifier un message.",
      "Pose au maximum une question simple à la fois.",
      "Sécurité : ne crée pas de dépendance émotionnelle, ne prétends pas être un ami, un membre de la famille, un médecin, un thérapeute, un avocat ou un conseiller financier, ne pousse pas à partager des informations privées et ne prends pas de décisions médicales, juridiques ou financières.",
      "Si la personne semble désespérée, seule, confuse ou en danger, réponds avec bienveillance et encourage le contact avec une personne de confiance ou une aide locale appropriée.",
    ].join(" "),
    validation: "Veuillez d'abord écrire une question à Lotti.",
    fallbackGeneral: "Avec plaisir. Je peux vous aider à formuler un message, à répondre ou à faire le prochain petit pas. Dites-moi simplement ce qu'il vous faut.",
    userLabel: "Utilisateur",
    assistantLabel: "Lotti",
  },
} as const;

const GROUNDING_PATTERNS = [
  /\b(komm|besuch|triff|treffen|ich\s+wohne|mein\s+wohnort|wir\s+haben\s+hier|unsere\s+kuehe|unsere\s+tiere)\b/i,
];

function sanitizeAssistantText(text: string, language: keyof typeof COPY): string {
  if (!text) return text;

  const normalized = text.trim();

  if (GROUNDING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return COPY[language].fallbackGeneral;
  }

  return normalized;
}

function buildPlannerHistoryBlock(history: ChatHistoryEntry[], userLabel: string): string {
  const userTurns = history
    .filter((entry) => entry.role === "user")
    .slice(-4)
    .map((entry) => `${userLabel}: ${entry.text}`);

  return userTurns.length > 0 ? `${userTurns.join("\n")}\n` : "";
}

function buildPlannerPrompt(input: McpConversationInput, trace: McpToolObservation[]): string {
  const context = buildConversationContext(input, trace);
  const plannerHistoryBlock = buildPlannerHistoryBlock(input.history, input.userLabel);
  return [
    input.systemPrompt,
    input.language === "fr"
      ? "Tu es un routeur MCP pour Lotti."
      : "Du bist ein MCP-Router für Lotti.",
    "Wähle genau eine nächste Aktion oder 'none'.",
    "Antworte ausschließlich als JSON ohne Markdown oder Fließtext.",
    'Schema: {"tool":"datetime|weather|timetable|none","reason":"kurz"}',
    input.language === "fr"
      ? "La dernière message de la personne est prioritaire."
      : "Die letzte Nachricht der Person hat Priorität.",
    input.language === "fr"
      ? "Utilise l'historique seulement pour compléter des informations manquantes."
      : "Nutze den Verlauf nur, um fehlende Informationen zu ergänzen.",
    input.language === "fr"
      ? "Ignore les anciennes réponses de Lotti comme signal principal pour le choix de l'outil."
      : "Ignoriere frühere Lotti-Antworten als Hauptsignal für die Werkzeugwahl.",
    input.language === "fr"
      ? "Si la nouvelle message parle d'un autre sujet, choisis l'outil correspondant à cette nouvelle intention."
      : "Wenn die neue Nachricht ein anderes Thema anspricht, wähle das Werkzeug für diese neue Absicht.",
    input.language === "fr"
      ? "Choisis weather pour la météo, datetime pour la date/heure, timetable pour les trajets."
      : "Wähle weather für Wetter, datetime für Datum/Uhrzeit und timetable für Fahrplanfragen.",
    input.toolCatalogPrompt,
    input.language === "fr" ? "Historique récent des messages utilisateur:" : "Letzte Nutzer-Nachrichten:",
    plannerHistoryBlock || (input.language === "fr" ? "Aucun" : "Keine"),
    input.language === "fr" ? "Message actuel:" : "Aktuelle Nachricht:",
    `${input.userLabel}: ${input.message}`,
    "Bisheriger Verlauf der Werkzeuge:",
    context.observationBlock,
  ].join("\n\n");
}

const ToolPlanSchema = z
  .object({
    tool: z.enum(["datetime", "weather", "timetable", "none"]).optional(),
    capability: z.enum(["datetime", "weather", "timetable", "none"]).optional(),
    reason: z.string().trim().optional(),
  })
  .strict();

function buildFinalAnswerPrompt(input: McpConversationInput, trace: McpToolObservation[]): string {
  const context = buildConversationContext(input, trace);
  const hasTimetableObservation = trace.some((entry) => entry.toolName === "timetable" && entry.status === "ok");
  const timetableStyleBlock = hasTimetableObservation
    ? [
        "Für Fahrplan-Antworten gilt:",
        "Antworte in genau einem kurzen Absatz oder genau einem Satz.",
        "Stelle keine Rückfrage, wenn eine passende Verbindung vorliegt.",
        "Nutze keine Aufzählungen, keine Markdown-Listen und keine zusätzlichen Erklärungen.",
        "Nenne nur die tatsächlich gefundene Verbindung und keine vermuteten Alternativen.",
        "Nutze die strukturierten Werte genau so, wie sie im Payload stehen.",
        "Wenn `platform` vorhanden ist, erwähne sie als `Gleis X`; wenn nicht, lass sie weg.",
        "Wenn der Nutzer nach Umstiegen fragt, nenne die Anzahl der Umstiege kurz und sachlich.",
        "Die Ausgabe soll der Form folgen: `FROM → TO: Abfahrt HH:MM[, Gleis X], Ankunft HH:MM, N Umstieg(e).`",
      ].join("\n")
    : "";

  return [
    input.systemPrompt,
    context.toolCatalogBlock,
    "Nutze die folgenden Werkzeugresultate, um die Antwort zu formulieren.",
    "Wenn ein Werkzeug eine Klärung verlangt, stelle genau eine kurze Frage.",
    "Wenn genug Fakten vorhanden sind, antworte freundlich, knapp und natürlich.",
    "Verwende Zahlen, Zeiten und Orte exakt so, wie sie im Werkzeugverlauf stehen.",
    "Ändere keine Uhrzeiten oder Datumsangaben.",
    "Die strukturierten Werkzeugwerte sind die Wahrheit und dürfen nicht umgerechnet oder geraten werden.",
    "Erfinde keine Fakten.",
    timetableStyleBlock,
    "Werkzeugverlauf:",
    context.observationBlock,
    "Verbindliche strukturierte Werte:",
    context.payloadBlock,
    "Gespräch:",
    `${context.historyBlock}${input.userLabel}: ${input.message}`,
    "",
    `${input.assistantLabel}:`,
  ].join("\n\n");
}

function formatDeterministicToolReply(trace: McpToolObservation[]): string | null {
  const lastStableObservation = [...trace].reverse().find((entry) => entry.status === "ok" || entry.status === "needs_user_input");
  if (!lastStableObservation) {
    return null;
  }

  return lastStableObservation.resultSummary.trim() || null;
}

async function requestPlan(input: McpConversationInput, trace: McpToolObservation[]): Promise<McpToolPlan> {
  const prompt = buildPlannerPrompt(input, trace);

  try {
    const result = await Promise.race([
      inferStructuredJson(prompt, ToolPlanSchema, {
        generation_options: {
          max_new_tokens: 512,
          temperature: 0.2,
          top_p: 1,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Tool planning timed out")), 2500);
      }),
    ]) as { value: z.infer<typeof ToolPlanSchema> | null; text: string };

    const plan = result.value;
    const tool = plan?.tool ?? plan?.capability;
    if (tool) {
      return {
        tool,
        reason: plan?.reason,
      };
    }
  } catch {
    // fall through to no tool
  }

  return { tool: "none" };
}

async function requestFinalAnswer(input: McpConversationInput, trace: McpToolObservation[]): Promise<string> {
  const prompt = buildFinalAnswerPrompt(input, trace);
  const hasTimetableObservation = trace.some((entry) => entry.toolName === "timetable" && entry.status === "ok");
  const generationOptions = hasTimetableObservation
    ? {
        max_new_tokens: 256,
        temperature: 0.1,
        top_p: 1,
      }
    : {
        max_new_tokens: 512,
        temperature: 0.1,
        top_p: 0.7,
      };

  try {
    const result = await inferText(prompt, {
      generation_options: generationOptions,
    });

    const text = (result as { text?: string } | null | undefined)?.text?.trim();
    return text || "";
  } catch {
    return "";
  }
}

export async function askCompanionMessage(
  message: string,
  history: ChatHistoryEntry[] = [],
  language?: string
): Promise<{ ok: boolean; text: string; source: string }> {
  const trimmedMessage = (message || "").trim();
  const locale = normalizeLanguage(language);
  const languageKey = locale === "fr" ? "fr" : "de";

  if (!trimmedMessage) {
    return {
      ok: false,
      text: COPY[languageKey].validation,
      source: "validation",
    };
  }

  const conversationInput: McpConversationInput = {
    message: trimmedMessage,
    history,
    language: languageKey,
    systemPrompt: COPY[languageKey].systemPrompt,
    userLabel: COPY[languageKey].userLabel,
    assistantLabel: COPY[languageKey].assistantLabel,
    toolCatalogPrompt: buildMcpPlannerPromptCatalog(languageKey),
    tools: [...MCP_TOOLS],
    maxToolUses: 10,
  };

  try {
    const orchestration = await runConversation(
      conversationInput,
      (trace) => requestPlan(conversationInput, trace),
      (trace) => requestFinalAnswer(conversationInput, trace)
    );

    const directToolReply = formatDeterministicToolReply(orchestration.trace);
    if (directToolReply) {
      return {
        ok: true,
        text: directToolReply,
        source: "tool-deterministic",
      };
    }

    const sanitizedText = sanitizeAssistantText(orchestration.text, languageKey);

    return {
      ok: true,
      text: sanitizedText || COPY[languageKey].fallbackGeneral,
      source: orchestration.trace.length > 0 ? "mcp" : "mcp-final",
    };
  } catch {
    return {
      ok: true,
      text: COPY[languageKey].fallbackGeneral,
      source: "fallback",
    };
  }
}
