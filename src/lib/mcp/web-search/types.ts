import type { McpRuntimeLocation } from "../types";

export type WebSearchIntent = "local" | "opening_hours" | "emergency_pharmacy" | "venue" | "product" | "topic";

export type WebSearchInput = {
  query: string;
  intent: WebSearchIntent;
  location?: McpRuntimeLocation;
  resolvedPlace?: string;
  maxResults?: number;
};

export type WebSearchResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  text?: string;
  markdown?: string;
  extracted?: WebSearchExtractedInfo;
};

export type WebSearchExtractedInfo = {
  phones: string[];
  openingHours: string[];
  addresses: string[];
  emails: string[];
  likelyNames: string[];
  scheduleRows: WebSearchScheduleRow[];
  documentFacts: WebSearchDocumentFact[];
};

export type WebSearchScheduleRow = {
  dateTime: string;
  category: string;
  title: string;
  venue: string;
};

export type WebSearchDocumentFact = {
  label: string;
  value: string;
  context: string;
};

export type WebSearchRaw = {
  query: string;
  intent: WebSearchIntent;
  resolvedPlace: string | null;
  results: WebSearchResult[];
  searchedAt: string;
  warning?: string;
};
