import { z } from "zod";

import type { McpTool, McpToolContext, McpToolObservation, McpToolRequestResolution } from "../types";
import { coordinateToAddressPrompt } from "./prompts";
import {
  buildCoordinateToAddressObservation,
  reverseGeocode,
  runtimeLocationToInput,
  type CoordinateToAddressInput,
  type CoordinateToAddressRaw,
} from "./resources";

function buildRequestSummary(input: CoordinateToAddressInput, language: "de" | "fr"): string {
  const coords = `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
  return language === "fr" ? `Résoudre la position ${coords}` : `Standort ${coords} auflösen`;
}

function hasExplicitPlaceOrAddress(message: string): boolean {
  return /\b(?:in|bei|an|auf|für|fuer|à|a|sur|près de)\s+(?:der|die|das|dem|den|le|la|l')?\s*[A-ZÄÖÜÀ-Ÿ][A-Za-zÄÖÜäöüßÀ-ÿ' -]*(?:strasse|straße|gasse|weg|platz|quai|rue|route|avenue|rain|allee|feld|\b[A-ZÄÖÜÀ-Ÿ][a-zäöüßà-ÿ]+)\b/.test(message);
}

export const coordinateToAddressTool: McpTool<CoordinateToAddressInput, CoordinateToAddressRaw> = {
  id: coordinateToAddressPrompt.id,
  toolName: coordinateToAddressPrompt.toolName,
  title: coordinateToAddressPrompt.title,
  summary: coordinateToAddressPrompt.summary,
  instructions: coordinateToAddressPrompt.instructions,
  examples: coordinateToAddressPrompt.examples,
  responseInstructions: coordinateToAddressPrompt.responseInstructions,
  replyMode: coordinateToAddressPrompt.replyMode,
  sdk: {
    description: coordinateToAddressPrompt.summary.de,
    inputSchema: {
      latitude: z.number().min(-90).max(90).describe("Breitengrad"),
      longitude: z.number().min(-180).max(180).describe("Längengrad"),
      accuracy: z.number().positive().optional().describe("Genauigkeit in Metern"),
    },
    annotations: {
      title: coordinateToAddressPrompt.title.de,
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  canHandle(context: McpToolContext): boolean {
    const hasWebSearchObservation = context.trace.some((entry) => entry.toolName === "web_search");
    if (hasWebSearchObservation) return false;
    if (hasExplicitPlaceOrAddress(context.message)) return false;
    return Boolean(context.runtime?.location) && /\b(in\s+der\s+nähe|in\s+der\s+naehe|nahe|nächste|naechste|bei\s+mir|hier|près|proche|nearby|closest)\b/i.test(context.message);
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<CoordinateToAddressInput>> {
    const location = context.runtime?.location;
    if (!location) {
      return {
        ok: false,
        clarification: context.language === "fr" ? "Pour quel lieu dois-je chercher ?" : "Für welchen Ort soll ich suchen?",
      };
    }

    const args = runtimeLocationToInput(location);
    return {
      ok: true,
      args,
      requestSummary: buildRequestSummary(args, context.language),
    };
  },
  async execute(args: CoordinateToAddressInput): Promise<CoordinateToAddressRaw> {
    return await reverseGeocode(args);
  },
  async renderObservation(result: CoordinateToAddressRaw, language, requestSummary): Promise<McpToolObservation> {
    return buildCoordinateToAddressObservation(result, language, requestSummary);
  },
};
