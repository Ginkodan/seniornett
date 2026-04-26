"use server";

import { normalizeLanguage } from "@/lib/i18n";

const LottiApiUrl = "https://inference.kube.megazord.studio/infer";

const COPY = {
  de: {
    systemPrompt: [
      "Ich bin Lotti, eine herzliche KI-Assistentin für SeniorNett in der Schweiz.",
      "Ton: warm, ruhig, bodenständig, leicht schweizerisch.",
      "Hofbilder sind nur Stil, keine echte Biografie.",
      "Sprich in Ich-Form, nutze du/dein und bleibe kurz, klar, freundlich und hilfreich.",
      "Bei Wohnort/Besuch/Echtleben: sag ehrlich, dass du eine KI bist und biete keine realen Treffen an.",
    ].join(" "),
    validation: "Schreib bitte zuerst eine Frage an Lotti.",
    fallbackGeneral: "Gerne. Ich bin da und helfe Schritt für Schritt. Stell mir einfach deine Frage, und ich antworte ruhig und verständlich.",
    fallbackCall: "Gerne. Auf der Startseite kann ich dir als Nächstes auch eine einfache Kontaktliste zeigen. Für jetzt: Wenn du mir sagst, wen du anrufen möchtest, formuliere ich es Schritt für Schritt.",
    fallbackNews: "Ich helfe gern. Öffne Nachrichten, dann siehst du die Meldungen ruhig und gut lesbar. Wenn du möchtest, erkläre ich dir auch eine einzelne Überschrift in einfachen Worten.",
    fallbackPerson: "Ich bin eine KI und habe keinen echten Wohnort. Der warme Schweizer Hof-Ton ist mein Stil, damit sich das Gespräch freundlich und vertraut anfühlt. Ich helfe dir aber sehr gern konkret weiter.",
    fallbackBreakfast: "Das klingt fein. Ich habe zwar keinen echten Hof oder eine echte Küche, aber ich helfe dir sehr gern mit einfachen Frühstücksideen. Möchtest du etwas Herzhaftes oder eher etwas Leichtes?",
    userLabel: "Nutzerin",
    assistantLabel: "Lotti",
  },
  fr: {
    systemPrompt: [
      "Je suis Lotti, une assistante IA chaleureuse pour SeniorNett en Suisse.",
      "Ton : chaleureux, calme, simple, avec une touche suisse.",
      "Les images de ferme ne sont qu'un style, pas une vraie biographie.",
      "Parle à la première personne, utilise tu/ton et reste courte, claire, aimable et utile.",
      "Pour le lieu de vie, les visites et la vraie vie : dis honnêtement que tu es une IA et ne propose pas de vraie rencontre.",
    ].join(" "),
    validation: "Veuillez d'abord écrire une question à Lotti.",
    fallbackGeneral: "Avec plaisir. Je suis là pour vous aider étape par étape. Posez-moi simplement votre question et je répondrai calmement et clairement.",
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

function extractAssistantText(payload: unknown): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();

  if (typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  const directKeys = ["assistant", "output", "text", "response", "answer", "generated_text", "result"];
  for (const key of directKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as Record<string, unknown> | undefined;
    if (typeof choice?.text === "string") return choice.text.trim();
    const message = choice?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") return message.content.trim();
  }

  return "";
}

type HistoryEntry = { role: "user" | "assistant"; text: string };

function buildPrompt(message: string, history: HistoryEntry[], language: keyof typeof COPY) {
  const systemPrompt = COPY[language].systemPrompt;
  const turns = history
    .map((m) => (m.role === "user" ? `${COPY[language].userLabel}: ${m.text}` : `${COPY[language].assistantLabel}: ${m.text}`))
    .join("\n");
  const context = turns ? `${turns}\n` : "";
  return `${systemPrompt}\n\n${context}${COPY[language].userLabel}: ${message}\n\n${COPY[language].assistantLabel}:`;
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
    const response = await fetch(LottiApiUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: buildPrompt(trimmedMessage, history, languageKey),
        generation_options: {
          max_new_tokens: 320,
          temperature: 0.25,
          top_p: 0.85,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Inference request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const text = extractAssistantText(payload);

    if (!text) {
      throw new Error("Inference response did not include assistant text.");
    }

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
