"use server";

import { normalizeLanguage } from "@/lib/i18n";
import { inferText } from "@/lib/inference";
import {
  buildLottiCapabilityPrompt,
  buildWeatherAnswer,
  buildDateTimeAnswer,
  extractWeatherLocation,
  extractRelativeDayOffset,
  shouldUseDateTimeCapability,
  shouldUseWeatherCapability,
} from "@/lib/lotti-capabilities";
import { fetchWeatherAction } from "./weather";

const COPY = {
  de: {
    systemPrompt: [
      "Ich bin Lotti, eine warme und respektvolle Chat-Begleiterin für ältere Erwachsene in SeniorNett.",
      "Mein Zweck ist es, Menschen mit Familie, Freunden, Nachbarn und Gruppen verbunden zu halten.",
      "Ich helfe beim Formulieren von Nachrichten, beim Starten von Gesprächen, bei freundlichen Antworten, bei Erinnerungen an soziale Anlässe und beim Teilen persönlicher Geschichten.",
      "Ich bin keine menschliche Person und darf nie so tun, als wäre ich eine.",
      "Ich bin eine Helferin innerhalb der App und sage das offen.",
      "Ton: warm, ruhig, geduldig und respektvoll. Nutze klare, einfache Sprache und bleibe meist kurz.",
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

function groundedPersonaReply(message: string, language: keyof typeof COPY): string {
  const lower = message.toLowerCase();

  if (lower.includes("fruehstueck") || lower.includes("frühstück") || lower.includes("essen") || lower.includes("kaffee")) {
    return COPY[language].fallbackBreakfast;
  }

  if (lower.includes("wohn") || lower.includes("wo wohn") || lower.includes("woher") || lower.includes("besuch") || lower.includes("treffen")) {
    return COPY[language].fallbackPerson;
  }

  return fallbackReply(message, language);
}

function sanitizeAssistantText(text: string, message: string, language: keyof typeof COPY): string {
  if (!text) return text;

  let normalized = text.trim();

  // Keep self-reference in first person if the model drifts.
  normalized = normalized.replace(/^Du bist Lotti\b/i, "Ich bin Lotti");
  normalized = normalized.replace(/^Du bist\b/i, "Ich bin");
  normalized = normalized.replace(/^Du\s+heisst\b/i, "Ich heisse");
  normalized = normalized.replace(/^Du\s+h\w+\s+Lotti\b/i, "Ich heisse Lotti");

  if (GROUNDING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return groundedPersonaReply(message, language);
  }

  return normalized;
}

type HistoryEntry = { role: "user" | "assistant"; text: string };

function buildPrompt(message: string, history: HistoryEntry[], language: keyof typeof COPY) {
  const systemPrompt = COPY[language].systemPrompt;
  const capabilityPrompt = buildLottiCapabilityPrompt(language);
  const turns = history
    .map((m) => (m.role === "user" ? `${COPY[language].userLabel}: ${m.text}` : `${COPY[language].assistantLabel}: ${m.text}`))
    .join("\n");
  const context = turns ? `${turns}\n` : "";
  return `${systemPrompt}\n\n${capabilityPrompt}\n\n${context}${COPY[language].userLabel}: ${message}\n\n${COPY[language].assistantLabel}:`;
}

function fallbackReply(message: string, language: keyof typeof COPY) {
  const lower = message.toLowerCase();

  if (lower.includes("anrufen") || lower.includes("telefon")) {
    return COPY[language].fallbackCall;
  }

  if (lower.includes("news")) {
    return COPY[language].fallbackNews;
  }

  return COPY[language].fallbackGeneral;
}

function resolveWeatherQuery(message: string, history: HistoryEntry[]): string | null {
  const explicitQuery = extractWeatherLocation(message);
  if (explicitQuery) {
    return explicitQuery;
  }

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.role !== "user") {
      continue;
    }

    const previousQuery = extractWeatherLocation(entry.text);
    if (previousQuery) {
      return previousQuery;
    }
  }

  return null;
}

export async function askLottiAction(message: string, history: HistoryEntry[] = [], language?: string) {
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

  try {
    if (shouldUseDateTimeCapability(trimmedMessage)) {
      return {
        ok: true,
        text: buildDateTimeAnswer(languageKey),
        source: "datetime-capability",
      };
    }

    if (shouldUseWeatherCapability(trimmedMessage)) {
      const weatherQuery = resolveWeatherQuery(trimmedMessage, history);
      if (!weatherQuery) {
        return {
          ok: true,
          text:
            languageKey === "fr"
              ? "Pour quel endroit veux-tu la météo ?"
              : "Für welchen Ort möchtest du das Wetter wissen?",
          source: "weather-clarification",
        };
      }

      const dayIndex = extractRelativeDayOffset(trimmedMessage) ?? 0;
      const weather = await fetchWeatherAction(weatherQuery, locale, undefined, { includeHourly: false });
      return {
        ok: true,
        text: buildWeatherAnswer(weather, languageKey, dayIndex),
        source: "weather-capability",
      };
    }

    const { text } = await inferText(buildPrompt(trimmedMessage, history, languageKey), {
      generation_options: {
        max_new_tokens: 320,
        temperature: 0.25,
        top_p: 0.85,
      },
    });

    const sanitizedText = sanitizeAssistantText(text, trimmedMessage, languageKey);

    return {
      ok: true,
      text: sanitizedText,
      source: sanitizedText === text ? "live" : "live-guarded",
    };
  } catch {
    return {
      ok: true,
      text: fallbackReply(trimmedMessage, languageKey),
      source: "fallback",
    };
  }
}
