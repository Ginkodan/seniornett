type GenerationOptions = {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
};

type InferRequest = {
  prompt: string;
  image_base64?: string;
  task?: "embed";
  model?: string;
  thinking?: boolean;
  web_mode?: boolean;
  include_web_trace?: boolean;
  generation_options?: GenerationOptions;
};

type InferResult<TPayload = unknown> = {
  payload: TPayload;
  text: string;
};

const INFERENCE_URL = process.env.SENIORNETT_INFERENCE_URL || "https://inference.kube.megazord.studio/infer";
const DEFAULT_TIMEOUT_MS = Number(process.env.SENIORNETT_INFERENCE_TIMEOUT_MS || 12000);

function extractText(payload: unknown): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();
  if (typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  const directKeys = ["assistant", "output", "text", "response", "answer", "generated_text", "result", "content"];
  for (const key of directKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as Record<string, unknown> | undefined;
    if (typeof choice?.text === "string" && choice.text.trim()) {
      return choice.text.trim();
    }

    const message = choice?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }

  return "";
}

function extractEmbedding(payload: unknown): number[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter((value): value is number => typeof value === "number");
  }
  if (typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const directKeys = ["embedding", "vector", "embeddings"];
  for (const key of directKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      if (value.every((entry) => typeof entry === "number")) {
        return value as number[];
      }
      if (value.length > 0 && Array.isArray(value[0])) {
        const nested = value[0];
        if (Array.isArray(nested) && nested.every((entry) => typeof entry === "number")) {
          return nested as number[];
        }
      }
    }
  }

  const data = record.data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (Array.isArray(first?.embedding)) {
      return first.embedding.filter((entry): entry is number => typeof entry === "number");
    }
    if (Array.isArray(first?.vector)) {
      return first.vector.filter((entry): entry is number => typeof entry === "number");
    }
  }

  return [];
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function postInference(body: InferRequest, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(INFERENCE_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Inference request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Inference request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function readInferenceText(payload: unknown): string {
  return extractText(payload);
}

export function readInferenceEmbedding(payload: unknown): number[] {
  return extractEmbedding(payload);
}

export async function inferJson<T>(
  prompt: string,
  options: Omit<InferRequest, "prompt" | "task"> = {}
): Promise<{ payload: unknown; text: string; value: T | null }> {
  const payload = await postInference({
    prompt,
    ...options,
  });
  const text = extractText(payload);

  return {
    payload,
    text,
    value: parseJsonObject<T>(text),
  };
}

export async function inferText(prompt: string, options: Omit<InferRequest, "prompt" | "image_base64" | "task"> = {}): Promise<InferResult> {
  const payload = await postInference({
    prompt,
    ...options,
  });

  const text = extractText(payload);
  if (!text) {
    throw new Error("Inference response did not include assistant text.");
  }

  return { payload, text };
}

export async function inferImage(
  prompt: string,
  imageBase64: string,
  options: Omit<InferRequest, "prompt" | "image_base64" | "task"> = {}
): Promise<InferResult> {
  const payload = await postInference({
    prompt,
    image_base64: imageBase64,
    ...options,
  });

  const text = extractText(payload);
  if (!text) {
    throw new Error("Inference response did not include assistant text.");
  }

  return { payload, text };
}

export async function embedText(prompt: string, options: Omit<InferRequest, "prompt" | "image_base64"> = {}): Promise<{ payload: unknown; vector: number[] }> {
  const payload = await postInference({
    prompt,
    task: "embed",
    ...options,
  });

  const vector = extractEmbedding(payload);
  if (!vector.length) {
    throw new Error("Inference response did not include an embedding vector.");
  }

  return { payload, vector };
}

export function parseJsonObject<T>(text: string): T | null {
  if (!text) return null;

  const stripped = stripCodeFence(text);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
