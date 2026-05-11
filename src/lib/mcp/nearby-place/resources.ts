import { chromium, type Browser } from "playwright";

import type { McpLanguage, McpToolObservation } from "../types";
import { nearbyPlacePrompt, isNearbyPlaceLookupMessage } from "./prompts";

const NOMINATIM_SEARCH_TIMEOUT_MS = 7000;
const DEFAULT_MAX_RESULTS = 8;
const BROWSER_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 SeniorNett/0.1 Chrome Safari";

let browserPromise: Promise<Browser> | null = null;

type NominatimSearchResponse = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  importance?: number;
  class?: string;
  type?: string;
  address?: Partial<Record<"road" | "house_number" | "suburb" | "village" | "town" | "city" | "postcode" | "state" | "country", string>>;
};

export type NearbyPlaceInput = {
  query: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  maxResults?: number;
};

export type NearbyPlaceCandidate = {
  name: string;
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  lat: number;
  lon: number;
  distanceMeters: number;
  displayName: string | null;
  category: string | null;
  type: string | null;
  source: string;
};

export type NearbyPlaceRaw = {
  request: NearbyPlaceInput;
  searchTerm: string;
  resolvedPlace: string | null;
  source: string;
  results: NearbyPlaceCandidate[];
  warning?: string;
  error?: string;
};

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
  }

  const browser = await browserPromise.catch((error) => {
    browserPromise = null;
    throw error;
  });

  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }

  return browser;
}

async function fetchJsonViaBrowser(url: string, timeoutMs: number): Promise<NominatimSearchResponse[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response) {
      throw new Error("No response");
    }

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }

    return await response.json() as NominatimSearchResponse[];
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusMeters = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radiusMeters * Math.asin(Math.sqrt(a));
}

function formatAddressLine(address: NominatimSearchResponse["address"]): string | null {
  if (!address) return null;
  const street = [address.road, address.house_number].filter(Boolean).join(" ").trim();
  const city = address.city || address.town || address.village || address.suburb;
  const place = [address.postcode, city].filter(Boolean).join(" ").trim();
  const parts = [street, place, address.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function formatNearbyLabel(result: NominatimSearchResponse): string | null {
  return (result.name || result.display_name || null)?.trim() || null;
}

function buildSearchTerm(query: string): string | null {
  const lowered = query.toLowerCase();
  if (/\bmigros\b/i.test(query)) return "Migros Supermarkt";
  if (/\bapothek|pharmacie\b/i.test(query)) return "Apotheke";
  if (/\bbäckerei|baeckerei|backerei\b/i.test(query)) return "Bäckerei";
  if (/\bmuseum\b/i.test(query)) return "Museum";
  if (/\btheater|theatre|opernhaus|oper\b/i.test(query)) return "Theater";
  if (/\brestaurant\b/i.test(query)) return "Restaurant";
  if (/\bsupermarkt\b/i.test(query)) return "Supermarkt";
  if (/\bladen|geschäft|geschaeft|shop\b/i.test(query)) return "Laden";

  const target = query
    .replace(/\b(welche|welcher|welches|was|wie|wann|wo|ist|sind|hat|haben|gibt|gib|mir|bitte|kann|ich|gerade|heute|morgen|nacht|nächste|nächsten|naechste|naechsten|nächstgelegene|nächstgelegenen|naechstgelegene|naechstgelegenen|in meiner nähe|in der nähe|near me|nearby|bei mir|zu mir|offen|geöffnet|finde|finden|bekomme|krieg(?:e)?|suche|vom|von)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return target || null;
}

function scoreCandidate(searchTerm: string, candidate: NearbyPlaceCandidate): number {
  const haystack = `${candidate.name} ${candidate.displayName || ""} ${candidate.addressLine || ""} ${candidate.category || ""} ${candidate.type || ""}`.toLowerCase();
  const lowered = searchTerm.toLowerCase();
  let score = 0;

  score -= candidate.distanceMeters / 1500;
  if (lowered && haystack.includes(lowered)) score += 20;
  if (/\bmigros\b/i.test(searchTerm)) {
    if (/\bmigros\b/i.test(haystack)) score += 15;
    if (/\b(supermarkt|filiale|markt|terminus)\b/i.test(haystack)) score += 10;
    if (/\b(restaurant|restaurant\b)/i.test(haystack)) score -= 12;
  }
  if (/\bapotheke|pharmacie\b/i.test(searchTerm)) {
    if (/\b(apotheke|pharmacie|notfall|garde)\b/i.test(haystack)) score += 15;
  }
  if (/\bbäckerei|baeckerei|backerei\b/i.test(searchTerm)) {
    if (/\b(bäckerei|baeckerei|bakery|boulangerie|confiserie)\b/i.test(haystack)) score += 15;
  }
  if (/\bmuseum\b/i.test(searchTerm)) {
    if (/\bmuseum\b/i.test(haystack)) score += 15;
  }
  if (/\btheater|theatre|oper\b/i.test(searchTerm)) {
    if (/\b(theater|theatre|oper|opernhaus)\b/i.test(haystack)) score += 15;
  }
  if (/\brestaurant\b/i.test(searchTerm) && /\brestaurant\b/i.test(haystack)) score += 12;
  return score;
}

function sortCandidates(searchTerm: string, candidates: NearbyPlaceCandidate[]): NearbyPlaceCandidate[] {
  return [...candidates]
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(searchTerm, candidate) }))
    .sort((left, right) => right.score - left.score || left.candidate.distanceMeters - right.candidate.distanceMeters || left.index - right.index)
    .map((entry) => entry.candidate);
}

function buildViewbox(latitude: number, longitude: number, radiusKm: number): string {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)));
  const left = longitude - lonDelta;
  const right = longitude + lonDelta;
  const top = latitude + latDelta;
  const bottom = latitude - latDelta;
  return `${left},${top},${right},${bottom}`;
}

function buildRequestSummary(input: NearbyPlaceInput, searchTerm: string, language: McpLanguage): string {
  const coords = `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;
  const label = language === "fr" ? "Lieu recherché" : "Gesuchter Ort";
  return language === "fr"
    ? `Rechercher ${searchTerm} près de ${coords} (${label})`
    : `Nächsten ${searchTerm} bei ${coords} suchen (${label})`;
}

function buildResolvedPlace(candidate: NearbyPlaceCandidate): string {
  if (candidate.name && candidate.addressLine) {
    return `${candidate.name}, ${candidate.addressLine}`;
  }
  return candidate.name || candidate.addressLine || candidate.displayName || `${candidate.lat},${candidate.lon}`;
}

export function isNearbyPlaceLookupMessageExport(message: string): boolean {
  return isNearbyPlaceLookupMessage(message);
}

export async function lookupNearbyPlace(input: NearbyPlaceInput): Promise<NearbyPlaceRaw> {
  const searchTerm = buildSearchTerm(input.query);
  if (!searchTerm) {
    return {
      request: input,
      searchTerm: input.query,
      resolvedPlace: null,
      source: "nominatim.openstreetmap.org",
      results: [],
      error: "no_target",
    };
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    q: searchTerm,
    addressdetails: "1",
    limit: String(Math.max(1, Math.min(DEFAULT_MAX_RESULTS, input.maxResults ?? DEFAULT_MAX_RESULTS))),
    countrycodes: "ch",
    "accept-language": "de",
    viewbox: buildViewbox(input.latitude, input.longitude, 15),
    bounded: "1",
  });

  try {
    const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SeniorNett/0.1 (local assistant place lookup)",
      },
    }, NOMINATIM_SEARCH_TIMEOUT_MS);

    if (!response.ok) {
      return {
        request: input,
        searchTerm,
        resolvedPlace: null,
        source: "nominatim.openstreetmap.org",
        results: [],
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as NominatimSearchResponse[];
    const candidates: NearbyPlaceCandidate[] = data
      .map((result) => {
        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const address = result.address;
        const city = address?.city || address?.town || address?.village || address?.suburb || null;
        const candidate: NearbyPlaceCandidate = {
          name: formatNearbyLabel(result) || searchTerm,
          addressLine: formatAddressLine(address),
          city,
          postcode: address?.postcode || null,
          country: address?.country || null,
          lat,
          lon,
          distanceMeters: haversineMeters(input.latitude, input.longitude, lat, lon),
          displayName: result.display_name || null,
          category: result.class || null,
          type: result.type || null,
          source: "nominatim.openstreetmap.org",
        };
        return candidate;
      })
      .filter((candidate): candidate is NearbyPlaceCandidate => Boolean(candidate));

    const ranked = sortCandidates(searchTerm, candidates).slice(0, Math.max(1, Math.min(DEFAULT_MAX_RESULTS, input.maxResults ?? DEFAULT_MAX_RESULTS)));
    return {
      request: input,
      searchTerm,
      resolvedPlace: ranked[0] ? buildResolvedPlace(ranked[0]) : null,
      source: "nominatim.openstreetmap.org",
      results: ranked,
      warning: ranked.length ? undefined : "search_empty",
    };
  } catch (error) {
    try {
      const data = await fetchJsonViaBrowser(`https://nominatim.openstreetmap.org/search?${params.toString()}`, NOMINATIM_SEARCH_TIMEOUT_MS);
      const candidates: NearbyPlaceCandidate[] = data
        .map((result) => {
          const lat = Number(result.lat);
          const lon = Number(result.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const address = result.address;
          const city = address?.city || address?.town || address?.village || address?.suburb || null;
          const candidate: NearbyPlaceCandidate = {
            name: formatNearbyLabel(result) || searchTerm,
            addressLine: formatAddressLine(address),
            city,
            postcode: address?.postcode || null,
            country: address?.country || null,
            lat,
            lon,
            distanceMeters: haversineMeters(input.latitude, input.longitude, lat, lon),
            displayName: result.display_name || null,
            category: result.class || null,
            type: result.type || null,
            source: "nominatim.openstreetmap.org",
          };
          return candidate;
        })
        .filter((candidate): candidate is NearbyPlaceCandidate => Boolean(candidate));

      const ranked = sortCandidates(searchTerm, candidates).slice(0, Math.max(1, Math.min(DEFAULT_MAX_RESULTS, input.maxResults ?? DEFAULT_MAX_RESULTS)));
      return {
        request: input,
        searchTerm,
        resolvedPlace: ranked[0] ? buildResolvedPlace(ranked[0]) : null,
        source: "nominatim.openstreetmap.org",
        results: ranked,
        warning: ranked.length ? undefined : "search_empty",
      };
    } catch (browserError) {
    return {
      request: input,
      searchTerm,
      resolvedPlace: null,
      source: "nominatim.openstreetmap.org",
      results: [],
      error: browserError instanceof Error ? browserError.message : error instanceof Error ? error.message : "Nearby place lookup failed",
    };
    }
  }
}

export function buildNearbyPlaceAnswer(raw: NearbyPlaceRaw, language: McpLanguage): string {
  if (!raw.results.length) {
    return language === "fr"
      ? "Je n'ai pas trouvé de lieu fiable à proximité."
      : "Ich habe keinen verlässlichen Ort in der Nähe gefunden.";
  }

  const best = raw.results[0];
  const distanceKm = (best.distanceMeters / 1000).toFixed(best.distanceMeters >= 1000 ? 1 : 0);
  const address = best.addressLine || best.displayName || "";
  return language === "fr"
    ? `Lieu le plus proche: ${best.name}${address ? `, ${address}` : ""} (${distanceKm} km)`
    : `Nächster Ort: ${best.name}${address ? `, ${address}` : ""} (${distanceKm} km)`;
}

export function buildNearbyPlaceObservation(raw: NearbyPlaceRaw, language: McpLanguage, requestSummary: string): McpToolObservation {
  return {
    toolName: nearbyPlacePrompt.toolName,
    requestSummary,
    resultSummary: buildNearbyPlaceAnswer(raw, language),
    status: raw.results.length ? "ok" : "needs_user_input",
    payload: JSON.stringify({
      searchTerm: raw.searchTerm,
      label: raw.resolvedPlace,
      resolvedPlace: raw.resolvedPlace,
      source: raw.source,
      warning: raw.warning ?? null,
      error: raw.error ?? null,
      results: raw.results.slice(0, 8).map((candidate) => ({
        name: candidate.name,
        addressLine: candidate.addressLine,
        city: candidate.city,
        postcode: candidate.postcode,
        country: candidate.country,
        lat: candidate.lat,
        lon: candidate.lon,
        distanceMeters: candidate.distanceMeters,
        displayName: candidate.displayName,
        category: candidate.category,
        type: candidate.type,
        source: candidate.source,
      })),
    }),
  };
}

export const _nearbyPlaceTestInternals = {
  buildSearchTerm,
  scoreCandidate,
  sortCandidates,
  buildViewbox,
  buildResolvedPlace,
};
