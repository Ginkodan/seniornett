import { normalizeLanguage } from "@/lib/i18n";
import { MCP_TOOLS, buildConversationContext, buildMcpPromptCatalog, runConversation, inferStructuredJson } from "@/lib/mcp";
import type { ChatHistoryEntry, McpConversationInput, McpToolObservation, McpToolPlan } from "@/lib/mcp";
import { extractTimetableContext } from "@/lib/mcp/timetable";
import { timetableTool } from "@/lib/mcp/timetable";
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
    fallbackCall: "Gerne. Auf der Startseite kann ich dir als Nächstes auch eine einfache Kontaktliste zeigen. Für jetzt: Wenn du mir sagst, wen du anrufen möchtest, formuliere ich es Schritt für Schritt.",
    fallbackNews: "Ich helfe gern. Öffne Nachrichten, dann siehst du die Meldungen ruhig und gut lesbar. Wenn du möchtest, erkläre ich dir auch eine einzelne Überschrift in einfachen Worten.",
    fallbackPerson: "Ich bin eine KI und habe keinen echten Wohnort. Der warme Schweizer Hof-Ton ist mein Stil, damit sich das Gespräch freundlich und vertraut anfühlt. Ich helfe dir aber sehr gern konkret weiter.",
    fallbackBreakfast: "Das klingt fein. Ich habe zwar keinen echten Hof oder eine echte Küche, aber ich helfe dir sehr gern mit einfachen Frühstücksideen. Möchtest du etwas Herzhaftes oder eher etwas Leichtes?",
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
    fallbackCall: "Avec plaisir. Sur la page d'accueil, je peux aussi vous montrer ensuite une liste de contacts simple. Pour l'instant, dites-moi qui vous voulez appeler et je vous aiderai pas à pas.",
    fallbackNews: "Je peux vous aider. Ouvrez les messages pour voir les nouvelles de manière calme et lisible. Si vous voulez, je peux aussi expliquer un titre en mots simples.",
    fallbackPerson: "Je suis une IA et je n'ai pas de lieu de vie réel. Le ton chaleureux de la ferme suisse est simplement mon style, pour que la conversation reste douce et familière. Je peux cependant vous aider très concrètement.",
    fallbackBreakfast: "C'est très bien. Je n'ai pas de vraie ferme ni de vraie cuisine, mais je peux volontiers vous proposer des idées de petit-déjeuner simples. Vous préférez quelque chose de salé ou de léger ?",
    userLabel: "Utilisateur",
    assistantLabel: "Lotti",
  },
} as const;

const GROUNDING_PATTERNS = [
  /\b(komm|komm\s+vorbei|besuch\s+mich|besuche\s+mich|triff\s+mich|treffen\s+wir)\b/i,
  /\b(hier\s+am\s+hof|bei\s+uns\s+am\s+hof|auf\s+meinem\s+hof|auf\s+unserem\s+hof)\b/i,
  /\b(ich\s+wohne|mein\s+wohnort|wir\s+haben\s+hier|ich\s+habe\s+hier|unsere\s+kuehe|unsere\s+tiere)\b/i,
];

const KEYWORD_SETS = {
  breakfast: ["fruehstueck", "frühstück", "essen", "kaffee"],
  person: ["wohn", "wo wohn", "woher", "besuch", "treffen"],
  call: ["anrufen", "telefon"],
  news: ["news"],
} as const;

function hasAnyKeyword(message: string, keywords: readonly string[]): boolean {
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function fallbackReply(message: string, language: keyof typeof COPY): string {
  if (hasAnyKeyword(message, KEYWORD_SETS.call)) {
    return COPY[language].fallbackCall;
  }

  if (hasAnyKeyword(message, KEYWORD_SETS.news)) {
    return COPY[language].fallbackNews;
  }

  return COPY[language].fallbackGeneral;
}

function groundedPersonaReply(message: string, language: keyof typeof COPY): string {
  if (hasAnyKeyword(message, KEYWORD_SETS.breakfast)) {
    return COPY[language].fallbackBreakfast;
  }

  if (hasAnyKeyword(message, KEYWORD_SETS.person)) {
    return COPY[language].fallbackPerson;
  }

  return fallbackReply(message, language);
}

function sanitizeAssistantText(text: string, message: string, language: keyof typeof COPY): string {
  if (!text) return text;

  let normalized = text.trim();

  normalized = normalized.replace(/^Du bist Lotti\b/i, "Ich bin Lotti");
  normalized = normalized.replace(/^Du bist\b/i, "Ich bin");
  normalized = normalized.replace(/^Du\s+heisst\b/i, "Ich heisse");
  normalized = normalized.replace(/^Du\s+h\w+\s+Lotti\b/i, "Ich heisse Lotti");

  if (GROUNDING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return groundedPersonaReply(message, language);
  }

  return normalized;
}

function buildPlannerPrompt(input: McpConversationInput, trace: McpToolObservation[]): string {
  const context = buildConversationContext(input, trace);

  return [
    input.systemPrompt,
    "Du bist ein MCP-ähnlicher Router für Lotti.",
    "Wähle genau eine nächste Aktion oder 'none'.",
    "Antworte ausschließlich als JSON ohne Markdown oder Fließtext.",
    'Schema: {"tool":"datetime|weather|timetable|none","reason":"kurz"}',
    "Wenn ein Werkzeug bereits genug Informationen geliefert hat, wähle 'none'.",
    "Wenn mehrere Werkzeuge sinnvoll sind, wähle zuerst dasjenige, das die nächste Lücke schließt.",
    "Verfügbare Werkzeuge:",
    input.toolCatalogPrompt,
    "Bisheriger Verlauf:",
    context.observationBlock,
    "Gespräch:",
    `${context.historyBlock}${input.userLabel}: ${input.message}`,
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

function formatDeterministicTimetableReply(trace: McpToolObservation[]): string | null {
  const lastTimetableObservation = [...trace].reverse().find((entry) => entry.toolName === "timetable" && entry.status === "ok");
  if (!lastTimetableObservation) {
    return null;
  }

  return lastTimetableObservation.resultSummary.trim() || null;
}

async function runDirectTimetableLookup(
  message: string,
  history: ChatHistoryEntry[],
  languageKey: "de" | "fr"
): Promise<{ ok: boolean; text: string; source: string } | null> {
  const context = extractTimetableContext(message, history);
  if (!context.from || !context.to || !context.date || !context.time) {
    return null;
  }

  const request = await timetableTool.buildRequest(message, history, languageKey, []);
  if (!request.ok) {
    return {
      ok: false,
      text: request.clarification,
      source: "timetable-clarification",
    };
  }

  const raw = await timetableTool.execute(request.args, languageKey);
  const observation = await timetableTool.renderObservation(raw, languageKey, request.requestSummary);
  return {
    ok: true,
    text: observation.resultSummary,
    source: "timetable-direct",
  };
}

function heuristicPlan(input: McpConversationInput): McpToolPlan {
  if (hasAnyKeyword(input.message, ["wetter", "regen", "schnee", "wind", "temperatur", "vorhersage", "prognose", "météo", "pluie", "neige", "vent"])) {
    return { tool: "weather" };
  }
  if (hasAnyKeyword(input.message, ["fahrplan", "verbindung", "verbindungen", "zug", "züge", "abfahrt", "ankunft", "train", "departure", "arrival", "horaire"])) {
    return { tool: "timetable" };
  }
  if (hasAnyKeyword(input.message, ["uhr", "uhrzeit", "zeit", "datum", "heute", "jetzt", "wochentag", "date", "heure"])) {
    return { tool: "datetime" };
  }
  return { tool: "none" };
}

async function requestPlan(input: McpConversationInput, trace: McpToolObservation[]): Promise<McpToolPlan> {
  const prompt = buildPlannerPrompt(input, trace);

  try {
    const result = await Promise.race([
      inferStructuredJson(prompt, ToolPlanSchema, {
        generation_options: {
          max_new_tokens: 64,
          temperature: 0,
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
    // fall back below
  }

  return heuristicPlan(input);
}

async function requestFinalAnswer(input: McpConversationInput, trace: McpToolObservation[]): Promise<string> {
  const prompt = buildFinalAnswerPrompt(input, trace);
  const hasTimetableObservation = trace.some((entry) => entry.toolName === "timetable" && entry.status === "ok");
  const generationOptions = hasTimetableObservation
    ? {
        max_new_tokens: 120,
        temperature: 0,
        top_p: 1,
      }
    : {
        max_new_tokens: 220,
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
    toolCatalogPrompt: buildMcpPromptCatalog(languageKey),
    tools: [...MCP_TOOLS],
    maxToolUses: 10,
  };

  try {
    const directTimetableReply = await runDirectTimetableLookup(trimmedMessage, history, languageKey);
    if (directTimetableReply) {
      return directTimetableReply;
    }

    const orchestration = await runConversation(
      conversationInput,
      (trace) => requestPlan(conversationInput, trace),
      (trace) => requestFinalAnswer(conversationInput, trace)
    );

    const timetableReply = formatDeterministicTimetableReply(orchestration.trace);
    if (timetableReply) {
      return {
        ok: true,
        text: timetableReply,
        source: "timetable-deterministic",
      };
    }

    const sanitizedText = sanitizeAssistantText(orchestration.text, trimmedMessage, languageKey);

    return {
      ok: true,
      text: sanitizedText || fallbackReply(trimmedMessage, languageKey),
      source: orchestration.trace.length > 0 ? "mcp" : "mcp-final",
    };
  } catch {
    return {
      ok: true,
      text: fallbackReply(trimmedMessage, languageKey),
      source: "fallback",
    };
  }
}
