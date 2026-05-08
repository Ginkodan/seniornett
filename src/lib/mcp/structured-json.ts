import { inferJson, parseJsonObject } from "@/lib/inference";
import { z } from "zod";

import type { StructuredInferenceResult } from "./types";

const STRUCTURED_INFERENCE_TIMEOUT_MS = 3500;

export async function inferStructuredJson<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
  options: Omit<Parameters<typeof inferJson<unknown>>[1], never> = {}
): Promise<StructuredInferenceResult<TSchema>> {
  try {
    const result = await Promise.race([
      inferJson<unknown>(prompt, options),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Structured inference timed out")), STRUCTURED_INFERENCE_TIMEOUT_MS);
      }),
    ]);

    const candidate = result.value ?? parseJsonObject<unknown>(result.text);
    const parsed = schema.safeParse(candidate);

    return {
      value: parsed.success ? parsed.data : null,
      text: result.text,
    };
  } catch {
    return {
      value: null,
      text: "",
    };
  }
}
