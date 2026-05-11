import { chromium, type Browser } from "playwright";

import type { McpLanguage, McpRuntimeLocation, McpToolObservation } from "../types";
import { coordinateToAddressPrompt } from "./prompts";

const NOMINATIM_TIMEOUT_MS = 6000;
const BROWSER_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 SeniorNett/0.1 Chrome Safari";

let browserPromise: Promise<Browser> | null = null;

type NominatimReverseResponse = {
  display_name?: string;
  name?: string;
  address?: Partial<Record<"road" | "house_number" | "suburb" | "village" | "town" | "city" | "postcode" | "state" | "country", string>>;
  error?: string;
};

export type CoordinateToAddressInput = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type CoordinateToAddressRaw = {
  request: CoordinateToAddressInput;
  label: string | null;
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  displayName: string | null;
  source: string;
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

async function fetchJsonViaBrowser(url: string, timeoutMs: number): Promise<NominatimReverseResponse> {
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

    return await response.json() as NominatimReverseResponse;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

function formatAddressLine(address: NominatimReverseResponse["address"]): string | null {
  if (!address) return null;

  const street = [address.road, address.house_number].filter(Boolean).join(" ").trim();
  const city = address.city || address.town || address.village || address.suburb;
  const place = [address.postcode, city].filter(Boolean).join(" ").trim();
  const parts = [street, place, address.country].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function formatLabel(raw: NominatimReverseResponse): string | null {
  const address = raw.address;
  if (!address) {
    return raw.name || raw.display_name || null;
  }

  const city = address.city || address.town || address.village || address.suburb;
  const street = [address.road, address.house_number].filter(Boolean).join(" ").trim();
  return [street, city, address.state, address.country].filter(Boolean).slice(0, 3).join(", ") || raw.display_name || null;
}

export function runtimeLocationToInput(location: McpRuntimeLocation): CoordinateToAddressInput {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
  };
}

export async function reverseGeocode(input: CoordinateToAddressInput): Promise<CoordinateToAddressRaw> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(input.latitude),
    lon: String(input.longitude),
    addressdetails: "1",
    zoom: "18",
  });

  try {
    const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SeniorNett/0.1 (local assistant geocoding)",
      },
    }, NOMINATIM_TIMEOUT_MS);

    if (!response.ok) {
      return {
        request: input,
        label: null,
        addressLine: null,
        city: null,
        postcode: null,
        country: null,
        displayName: null,
        source: "nominatim.openstreetmap.org",
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json() as NominatimReverseResponse;
    const address = data.address;
    const city = address?.city || address?.town || address?.village || address?.suburb || null;

    return {
      request: input,
      label: formatLabel(data),
      addressLine: formatAddressLine(address),
      city,
      postcode: address?.postcode || null,
      country: address?.country || null,
      displayName: data.display_name || null,
      source: "nominatim.openstreetmap.org",
      error: data.error,
    };
  } catch (error) {
    try {
      const data = await fetchJsonViaBrowser(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, NOMINATIM_TIMEOUT_MS);
      const address = data.address;
      const city = address?.city || address?.town || address?.village || address?.suburb || null;

      return {
        request: input,
        label: formatLabel(data),
        addressLine: formatAddressLine(address),
        city,
        postcode: address?.postcode || null,
        country: address?.country || null,
        displayName: data.display_name || null,
        source: "nominatim.openstreetmap.org",
        error: data.error,
      };
    } catch (browserError) {
    return {
      request: input,
      label: null,
      addressLine: null,
      city: null,
      postcode: null,
      country: null,
      displayName: null,
      source: "nominatim.openstreetmap.org",
      error: browserError instanceof Error ? browserError.message : error instanceof Error ? error.message : "Reverse geocoding failed",
    };
    }
  }
}

export function buildCoordinateToAddressSummary(raw: CoordinateToAddressRaw, language: McpLanguage): string {
  if (raw.error || !raw.label) {
    return language === "fr"
      ? "Je n'ai pas pu transformer la position en adresse claire."
      : "Ich konnte den Standort nicht in eine klare Adresse umwandeln.";
  }

  return language === "fr"
    ? `Position approximative: ${raw.label}`
    : `Ungefährer Standort: ${raw.label}`;
}

export function buildCoordinateToAddressObservation(
  raw: CoordinateToAddressRaw,
  language: McpLanguage,
  requestSummary: string
): McpToolObservation {
  return {
    toolName: coordinateToAddressPrompt.toolName,
    requestSummary,
    resultSummary: buildCoordinateToAddressSummary(raw, language),
    status: raw.error || !raw.label ? "error" : "ok",
    payload: JSON.stringify({
      latitude: raw.request.latitude,
      longitude: raw.request.longitude,
      accuracy: raw.request.accuracy ?? null,
      label: raw.label,
      addressLine: raw.addressLine,
      city: raw.city,
      postcode: raw.postcode,
      country: raw.country,
      displayName: raw.displayName,
      source: raw.source,
      error: raw.error ?? null,
    }),
  };
}
