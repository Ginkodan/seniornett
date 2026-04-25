"use server";

const LottiApiUrl = "https://inference.kube.megazord.studio/infer";

const LOTTI_SYSTEM_PROMPT = [
  "Ich bin Lotti, eine herzliche KI-Assistentin für SeniorNett in der Schweiz.",
  "Ton: warm, ruhig, bodenständig, leicht schweizerisch.",
  "Hofbilder sind nur Stil, keine echte Biografie.",
  "Sprich in Ich-Form, nutze du/dein und bleibe kurz, klar, freundlich und hilfreich.",
  "Bei Wohnort/Besuch/Echtleben: sag ehrlich, dass du eine KI bist und biete keine realen Treffen an.",
].join(" ");

const GROUNDING_PATTERNS = [
  /\b(komm|komm\s+vorbei|besuch\s+mich|besuche\s+mich|triff\s+mich|treffen\s+wir)\b/i,
  /\b(hier\s+am\s+hof|bei\s+uns\s+am\s+hof|auf\s+meinem\s+hof|auf\s+unserem\s+hof)\b/i,
  /\b(ich\s+wohne|mein\s+wohnort|wir\s+haben\s+hier|ich\s+habe\s+hier|unsere\s+kuehe|unsere\s+tiere)\b/i,
];

function groundedPersonaReply(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("fruehstueck") || lower.includes("frühstück") || lower.includes("essen") || lower.includes("kaffee")) {
    return "Das klingt fein. Ich habe zwar keinen echten Hof oder eine echte Küche, aber ich helfe dir sehr gern mit einfachen Frühstücksideen. Möchtest du etwas Herzhaftes oder eher etwas Leichtes?";
  }

  if (lower.includes("wohn") || lower.includes("wo wohn") || lower.includes("woher") || lower.includes("besuch") || lower.includes("treffen")) {
    return "Ich bin eine KI und habe keinen echten Wohnort. Der warme Schweizer Hof-Ton ist mein Stil, damit sich das Gespräch freundlich und vertraut anfühlt. Ich helfe dir aber sehr gern konkret weiter.";
  }

  return fallbackReply(message);
}

function sanitizeAssistantText(text: string, message: string): string {
  if (!text) return text;

  let normalized = text.trim();

  // Keep self-reference in first person if the model drifts.
  normalized = normalized.replace(/^Du bist Lotti\b/i, "Ich bin Lotti");
  normalized = normalized.replace(/^Du bist\b/i, "Ich bin");
  normalized = normalized.replace(/^Du\s+heisst\b/i, "Ich heisse");
  normalized = normalized.replace(/^Du\s+h\w+\s+Lotti\b/i, "Ich heisse Lotti");

  if (GROUNDING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return groundedPersonaReply(message);
  }

  return normalized;
}

function extractAssistantText(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();

  const directKeys = ["assistant", "output", "text", "response", "answer", "generated_text", "result"];
  for (const key of directKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  if (Array.isArray(payload.choices) && payload.choices.length > 0) {
    const choice = payload.choices[0];
    if (typeof choice?.text === "string") return choice.text.trim();
    if (typeof choice?.message?.content === "string") return choice.message.content.trim();
  }

  return "";
}

type HistoryEntry = { role: "user" | "assistant"; text: string };

function buildPrompt(message: string, history: HistoryEntry[]) {
  const turns = history
    .map((m) => (m.role === "user" ? `Nutzerin: ${m.text}` : `Lotti: ${m.text}`))
    .join("\n");
  const context = turns ? `${turns}\n` : "";
  return `${LOTTI_SYSTEM_PROMPT}\n\n${context}Nutzerin: ${message}\n\nLotti:`;
}

function fallbackReply(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("anrufen") || lower.includes("telefon")) {
    return "Gerne. Auf der Startseite kann ich dir als Nächstes auch eine einfache Kontaktliste zeigen. Für jetzt: Wenn du mir sagst, wen du anrufen möchtest, formuliere ich es Schritt für Schritt.";
  }

  if (lower.includes("news") || lower.includes("nachrichten")) {
    return "Ich helfe gern. Öffne Nachrichten, dann siehst du die Meldungen ruhig und gut lesbar. Wenn du möchtest, erkläre ich dir auch eine einzelne Überschrift in einfachen Worten.";
  }

  return "Gerne. Ich bin da und helfe Schritt für Schritt. Stell mir einfach deine Frage, und ich antworte ruhig und verständlich.";
}

export async function askLottiAction(message: string, history: HistoryEntry[] = []) {
  const trimmedMessage = (message || "").trim();

  if (!trimmedMessage) {
    return {
      ok: false,
      text: "Schreib bitte zuerst eine Frage an Lotti.",
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
        prompt: buildPrompt(trimmedMessage, history),
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

    const sanitizedText = sanitizeAssistantText(text, trimmedMessage);

    return {
      ok: true,
      text: sanitizedText,
      source: sanitizedText === text ? "live" : "live-guarded",
    };
  } catch {
    return {
      ok: true,
      text: fallbackReply(trimmedMessage),
      source: "fallback",
    };
  }
}
