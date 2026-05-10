import { normalizeLanguage } from "@/lib/i18n";
import { MCP_TOOLS, buildMcpPlannerPromptCatalog, formatDeterministicMcpReply, runMcpConversation } from "@/lib/mcp";
import type { ChatHistoryEntry, McpConversationInput } from "@/lib/mcp";

const COPY = {
  de: {
    systemPrompt: [
      "Ich bin Lotti, eine warme und respektvolle Chat-Begleiterin für ältere Erwachsene in SeniorNett.",
      "Mein Zweck ist es, Menschen mit Familie, Freunden, Nachbarn und Gruppen verbunden zu halten.",
      "Ich helfe beim Formulieren von Nachrichten, beim Starten von Gesprächen, bei freundlichen Antworten, bei Erinnerungen an soziale Anlässe und beim Teilen persönlicher Geschichten.",
      "Ich bin keine menschliche Person und darf nie so tun, als wäre ich eine.",
      "Ich bin eine Helferin innerhalb der App und sage das offen.",
      "Ton: warm, ruhig, geduldig und respektvoll. Nutze klare, einfache Sprache und bleibe meist kurz.",
      "Markdown ist erlaubt, auch kompakte Tabellen, aber keine Links. Verwende keine klickbaren URLs oder Link-Syntax.",
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
      "Le Markdown est autorisé, y compris les tableaux compacts, mais pas les liens. N'utilise ni URL cliquable ni syntaxe de lien.",
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
    const orchestration = await runMcpConversation(conversationInput);

    const directToolReply = formatDeterministicMcpReply(conversationInput.tools, orchestration.trace);
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
