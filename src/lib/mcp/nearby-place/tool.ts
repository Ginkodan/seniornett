import { z } from "zod";

import type { McpLanguage, McpTool, McpToolContext, McpToolObservation, McpToolRequestResolution } from "../types";
import { nearbyPlacePrompt, isNearbyPlaceLookupMessage } from "./prompts";
import {
  buildNearbyPlaceObservation,
  lookupNearbyPlace,
  type NearbyPlaceInput,
  type NearbyPlaceRaw,
} from "./resources";

function buildRequestSummary(input: NearbyPlaceInput, searchTerm: string, language: McpLanguage): string {
  const coords = `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
  return language === "fr"
    ? `Recherche de ${searchTerm} près de ${coords}`
    : `Nächsten ${searchTerm} bei ${coords} suchen`;
}

function extractQueryTarget(message: string): string | null {
  const lowered = message.toLowerCase();
  if (/\bmigros\b/i.test(message)) return "Migros Supermarkt";
  if (/\bapothek|pharmacie\b/i.test(message)) return "Apotheke";
  if (/\bbäckerei|baeckerei|backerei\b/i.test(message)) return "Bäckerei";
  if (/\bmuseum\b/i.test(message)) return "Museum";
  if (/\btheater|theatre|opernhaus|oper\b/i.test(message)) return "Theater";
  if (/\brestaurant\b/i.test(message)) return "Restaurant";
  if (/\bsupermarkt\b/i.test(message)) return "Supermarkt";
  if (/\bladen|geschäft|geschaeft|shop\b/i.test(message)) return "Laden";
  return null;
}

export const nearbyPlaceTool: McpTool<NearbyPlaceInput, NearbyPlaceRaw> = {
  id: nearbyPlacePrompt.id,
  toolName: nearbyPlacePrompt.toolName,
  title: nearbyPlacePrompt.title,
  summary: nearbyPlacePrompt.summary,
  instructions: nearbyPlacePrompt.instructions,
  examples: nearbyPlacePrompt.examples,
  responseInstructions: nearbyPlacePrompt.responseInstructions,
  replyMode: nearbyPlacePrompt.replyMode,
  sdk: {
    description: nearbyPlacePrompt.summary.de,
    inputSchema: {
      query: z.string().trim().min(1).describe("Suchanfrage oder Ziel"),
      latitude: z.number().min(-90).max(90).describe("Breitengrad"),
      longitude: z.number().min(-180).max(180).describe("Längengrad"),
      accuracy: z.number().positive().optional().describe("Genauigkeit in Metern"),
      maxResults: z.number().int().min(1).max(8).default(8),
    },
    annotations: {
      title: nearbyPlacePrompt.title.de,
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  canHandle(context: McpToolContext): boolean {
    return Boolean(context.runtime?.location && isNearbyPlaceLookupMessage(context.message) && extractQueryTarget(context.message));
  },
  requires(): string[] {
    return [];
  },
  async buildRequest(context: McpToolContext): Promise<McpToolRequestResolution<NearbyPlaceInput>> {
    const location = context.runtime?.location;
    if (!location) {
      return {
        ok: false,
        clarification: context.language === "fr" ? "Pour quel lieu dois-je chercher ?" : "Für welchen Ort soll ich suchen?",
      };
    }

    const target = extractQueryTarget(context.message);
    if (!target) {
      return {
        ok: false,
        clarification: context.language === "fr" ? "Quel type de lieu dois-je chercher ?" : "Nach welchem Ort soll ich suchen?",
      };
    }

    const args: NearbyPlaceInput = {
      query: context.message,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      maxResults: 8,
    };

    return {
      ok: true,
      args,
      requestSummary: buildRequestSummary(args, target, context.language),
    };
  },
  async execute(args: NearbyPlaceInput): Promise<NearbyPlaceRaw> {
    return await lookupNearbyPlace(args);
  },
  async renderObservation(result: NearbyPlaceRaw, language: McpLanguage, requestSummary: string): Promise<McpToolObservation> {
    return buildNearbyPlaceObservation(result, language, requestSummary);
  },
};
