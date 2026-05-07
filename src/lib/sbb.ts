// SBB Train timetable integration using transport.opendata.ch API
// This API provides real-time train connection data for Switzerland

import JSZip from "jszip";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface StopPoint {
  station: string;
  arrival?: string;
  departure?: string;
  delay?: number;
  platform?: string;
}

export interface Leg {
  number: string;
  category: string;
  direction?: string;
  departureTime: string;
  arrivalTime: string;
  departureStation: string;
  arrivalStation: string;
  departurePlatform?: string;
  arrivalPlatform?: string;
  departureDelay?: number;
  arrivalDelay?: number;
  departurePrognosisTime?: string;
  arrivalPrognosisTime?: string;
  departurePrognosisPlatform?: string;
  arrivalPrognosisPlatform?: string;
  cancelled?: boolean;
  hasRealtimeData?: boolean;
}

export interface Connection {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  departureIso: string;
  arrivalIso: string;
  duration: string;
  changes: number;
  legs: Leg[];
  platform?: string;
  transferAssessments?: TransferAssessment[];
  accessAssessment?: TransferAssessment | null;
  destinationAssessment?: TransferAssessment | null;
  accessTargetCoords?: { lat: number; lon: number } | null;
  destinationTargetCoords?: { lat: number; lon: number } | null;
}

export interface TransferAssessment {
  givenMinutes: number | null;
  requiredMinutes: number | null;
  slackMinutes: number | null;
  walkMinutes: number | null;
  walkDistanceMeters?: number | null;
  tone: "tight" | "okay" | "plenty" | "unknown";
}

export interface Station {
  id: string;
  name: string;
}

export interface SearchResult {
  connections: Connection[];
  from: string;
  to: string;
  page: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  error?: string;
}

export interface StationSearchResult {
  stations: Station[];
  error?: string;
}

interface ApiStation {
  id: string;
  name: string;
}

interface ApiStationsResponse {
  stations?: ApiStation[];
}

interface ApiSection {
  journey?: {
    number?: string;
    name?: string;
    category?: string;
    to?: string;
    departure?: string;
    arrival?: string;
  };
  departure?: {
    departure?: string;
    delay?: number | null;
    station?: {
      name?: string;
    };
    platform?: string;
    prognosis?: {
      platform?: string | null;
      arrival?: string | null;
      departure?: string | null;
    };
    realtimeAvailability?: unknown;
    cancelled?: boolean | null;
    canceled?: boolean | null;
  };
  arrival?: {
    arrival?: string;
    delay?: number | null;
    station?: {
      name?: string;
    };
    platform?: string;
    prognosis?: {
      platform?: string | null;
      arrival?: string | null;
      departure?: string | null;
    };
    realtimeAvailability?: unknown;
    cancelled?: boolean | null;
    canceled?: boolean | null;
  };
}

interface ApiConnection {
  from: {
    departure: string;
    platform?: string;
    station: {
      name: string;
    };
  };
  to: {
    arrival: string;
    station: {
      name: string;
    };
  };
  transfers?: number;
  sections?: ApiSection[];
}

interface ApiConnectionsResponse {
  connections?: ApiConnection[];
}

interface GtfsStopRow {
  stop_id?: string;
  stop_name?: string;
  platform_code?: string;
  original_stop_id?: string;
  stop_lat?: string;
  stop_lon?: string;
  parent_station?: string;
}

interface GtfsTransferRow {
  from_stop_id?: string;
  to_stop_id?: string;
  transfer_type?: string;
  min_transfer_time?: string;
  from_trip_id?: string;
  to_trip_id?: string;
  from_route_id?: string;
  to_route_id?: string;
}

interface SwissGtfsTransferDataset {
  stopIdsByStation: Map<string, string[]>;
  stopIdsByStationAndPlatform: Map<string, string[]>;
  stopsById: Map<string, { name: string; lat: number | null; lon: number | null }>;
  transferRules: Map<string, { transferType: number; minTransferTimeSec: number | null }[]>;
}

interface GeoCoordinate {
  lat: number;
  lon: number;
}

interface ResolvedLocationTarget {
  displayLabel: string;
  routingQuery: string;
  targetCoords: GeoCoordinate | null;
}

const SWISS_TIME_ZONE = "Europe/Zurich";
const SWISS_GTFS_DATASET_PAGE_URL = "https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020";
const MAX_CONNECTION_PAGE = 3;
const INITIAL_RESULTS_PAGE = 1;
const DEFAULT_TRANSFER_MINUTES = 2;
const GTFS_CACHE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;
const WALKING_ROUTE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;
const WALKING_ROUTE_BASE_URL = "https://router.project-osrm.org/route/v1/foot";
const GTFS_LOCAL_CACHE_DIR = join(process.cwd(), ".cache", "swiss-gtfs");
const GTFS_LOCAL_CACHE_PATH = join(GTFS_LOCAL_CACHE_DIR, "gtfs_fp2026_latest.zip");
const WALKING_METERS_PER_MINUTE = 70;
const WALKING_BUFFER_MINUTES = 2;

let swissGtfsTransferDatasetPromise: Promise<SwissGtfsTransferDataset | null> | null = null;
const walkingRouteEstimateCache = new Map<string, Promise<{ distanceMeters: number; minutes: number } | null>>();
const locationTargetCache = new Map<string, Promise<ResolvedLocationTarget>>();

/**
 * Search for stations by name
 */
export async function searchStations(query: string): Promise<StationSearchResult> {
  if (!query || query.trim().length < 2) {
    return { stations: [] };
  }

  try {
    const url = `https://transport.opendata.ch/v1/locations?query=${encodeURIComponent(query)}&type=station`;
    const response = await fetch(url, { cache: "force-cache" });

    if (!response.ok) {
      return {
        stations: [],
        error: `Failed to search stations: ${response.statusText}`,
      };
    }

    const data = await response.json() as ApiStationsResponse;
    const stations = (data.stations || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    return { stations };
  } catch (error) {
    return {
      stations: [],
      error: `Error searching stations: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function geocodeSwissLocation(query: string): Promise<GeoCoordinate | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ch");
    url.searchParams.set("q", normalizedQuery);

    const response = await fetch(url.toString(), {
      headers: {
        "Accept-Language": "de-CH,de;q=0.9",
        "User-Agent": "SeniorNett/1.0",
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as Array<{ lat?: string; lon?: string }>;
    const first = data[0];
    const lat = normalizeStopCoordinate(first?.lat);
    const lon = normalizeStopCoordinate(first?.lon);
    if (lat === null || lon === null) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

function findNearestStopId(dataset: SwissGtfsTransferDataset | null, coords: GeoCoordinate): string | null {
  if (!dataset) return null;

  let bestStationLike: { stopId: string; distance: number } | null = null;
  let bestOverall: { stopId: string; distance: number } | null = null;

  for (const [stopId, stop] of dataset.stopsById.entries()) {
    if (stop.lat === null || stop.lon === null) continue;
    const distance = haversineDistanceMeters(coords, { lat: stop.lat, lon: stop.lon });

    if (bestOverall === null || distance < bestOverall.distance) {
      bestOverall = { stopId, distance };
    }

    if (isStationLikeStopName(stop.name)) {
      if (bestStationLike === null || distance < bestStationLike.distance) {
        bestStationLike = { stopId, distance };
      }
    }
  }

  return bestStationLike?.stopId ?? bestOverall?.stopId ?? null;
}

function isStationLikeStopName(name: string | undefined): boolean {
  const normalized = normalizeStationKey(name);
  if (!normalized) return false;

  return /\b(bahnhof|station|gare|staziun|hbf|central)\b/i.test(normalized);
}

async function resolveLocationTarget(
  query: string,
  dataset: SwissGtfsTransferDataset | null
): Promise<ResolvedLocationTarget> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      displayLabel: "",
      routingQuery: "",
      targetCoords: null,
    };
  }

  const cacheKey = normalizedQuery.toLowerCase();
  const cached = locationTargetCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const looksLikeAddress = /[0-9,]/.test(normalizedQuery) || /\b(str\.?|strasse|straße|weg|gasse|platz|allee|quai|promenade)\b/i.test(normalizedQuery);

    const tryStationQueries = async (candidates: string[], displayLabel: string, targetCoords: GeoCoordinate | null) => {
      for (const candidate of candidates) {
        const normalizedCandidate = candidate.trim();
        if (!normalizedCandidate) continue;

        const stationResult = await searchStations(normalizedCandidate);
        const station = stationResult.stations[0];
        if (station) {
          return {
            displayLabel,
            routingQuery: station.id || station.name,
            targetCoords,
          };
        }
      }

      return null;
    };

    if (!looksLikeAddress) {
      const stationResult = await searchStations(normalizedQuery);
      const station = stationResult.stations[0];
      if (station) {
        return {
          displayLabel: station.name,
          routingQuery: station.id || station.name,
          targetCoords: null,
        };
      }
    }

    const geocoded = await geocodeSwissLocation(normalizedQuery);
    if (geocoded) {
      const nearestStopId = findNearestStopId(dataset, geocoded);
      const nearestStopName = nearestStopId ? getStopName(dataset, nearestStopId) : null;
      if (nearestStopName) {
        const candidateQueries = [
          nearestStopName,
          stripLocationQuery(nearestStopName),
          stripLocationQuery(normalizedQuery),
        ].filter((candidate, index, values) => candidate && values.indexOf(candidate) === index);

        const stationTarget = await tryStationQueries(candidateQueries, normalizedQuery, geocoded);
        if (stationTarget) {
          return stationTarget;
        }
      }

      return {
        displayLabel: normalizedQuery,
        routingQuery: nearestStopName || normalizedQuery,
        targetCoords: geocoded,
      };
    }

    const stationResult = await searchStations(normalizedQuery);
    const station = stationResult.stations[0];
    if (station) {
      return {
        displayLabel: station.name,
        routingQuery: station.id || station.name,
        targetCoords: null,
      };
    }

    const stripped = stripLocationQuery(normalizedQuery);
    if (stripped && stripped.toLowerCase() !== cacheKey) {
      const strippedStations = await searchStations(stripped);
      const strippedStation = strippedStations.stations[0];
      if (strippedStation) {
        return {
          displayLabel: normalizedQuery,
          routingQuery: strippedStation.id || strippedStation.name,
          targetCoords: null,
        };
      }
    }

    return {
      displayLabel: normalizedQuery,
      routingQuery: normalizedQuery,
      targetCoords: null,
    };
  })();

  locationTargetCache.set(cacheKey, pending);
  return pending;
}

/**
 * Parse duration from ISO 8601 format (e.g., PT2H30M)
 */
function parseDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours === 0 && minutes === 0) return "0m";
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format time from ISO format to HH:MM
 */
function formatTime(isoTime?: string): string {
  if (!isoTime) return "–";
  try {
    const trimmed = isoTime.trim();
    const localParts = hasExplicitTimezone(trimmed) ? null : parseSwissLocalDateTime(trimmed);
    if (localParts) {
      return `${String(localParts.hours).padStart(2, "0")}:${String(localParts.minutes).padStart(2, "0")}`;
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return isoTime;
    const parts = formatSwissDateParts(date);
    return parts?.time ?? isoTime;
  } catch {
    return isoTime;
  }
}

function getSwissDateKey(isoTime: string): string | null {
  const trimmed = isoTime.trim();
  const localParts = hasExplicitTimezone(trimmed) ? null : parseSwissLocalDateTime(trimmed);
  if (localParts) return localParts.date;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return formatSwissDateParts(date)?.date ?? null;
}

function parseTimeMinutes(value: string): number | null {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function shiftSwissDateTime(date: string, time: string, offsetMinutes: number) {
  const year = Number.parseInt(date.slice(0, 4), 10);
  const month = Number.parseInt(date.slice(5, 7), 10);
  const day = Number.parseInt(date.slice(8, 10), 10);
  const hours = Number.parseInt(time.slice(0, 2), 10);
  const minutes = Number.parseInt(time.slice(3, 5), 10);

  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }

  const shifted = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  shifted.setUTCMinutes(shifted.getUTCMinutes() + offsetMinutes);

  return {
    date: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
  };
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function parseSwissLocalDateTime(value: string): { date: string; hours: number; minutes: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return null;

  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    hours: Number.parseInt(match[4], 10),
    minutes: Number.parseInt(match[5], 10),
  };
}

function formatSwissDateParts(date: Date): { date: string; time: string } | null {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SWISS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!lookup.year || !lookup.month || !lookup.day || !lookup.hour || !lookup.minute) return null;
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}:${lookup.minute}`,
  };
}

function normalizeStationKey(value?: string): string {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function stripLocationQuery(value: string): string {
  return value
    .replace(/\b\d+[a-z]?\b/gi, " ")
    .replace(/[;,].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStopCoordinate(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseCsvText(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const flushCell = () => {
    row.push(cell);
    cell = "";
  };

  const flushRow = () => {
    if (row.length > 0) {
      rows.push(row);
      row = [];
    }
  };

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      flushCell();
      continue;
    }

    if (char === "\n") {
      flushCell();
      flushRow();
      continue;
    }

    if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    flushCell();
    flushRow();
  }

  const headers = rows.shift();
  if (!headers || headers.length === 0) return [];

  return rows
    .filter((currentRow) => currentRow.some((value) => value.trim().length > 0))
    .map((currentRow) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = currentRow[index] ?? "";
      });
      return record;
    });
}

function parseInteger(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseGtfsStops(rows: GtfsStopRow[]) {
  const stopIdsByStation = new Map<string, string[]>();
  const stopIdsByStationAndPlatform = new Map<string, string[]>();
  const stopsById = new Map<string, { name: string; lat: number | null; lon: number | null }>();

  for (const row of rows) {
    const stopId = row.stop_id?.trim();
    const stopName = normalizeStationKey(row.stop_name);
    const platformCode = row.platform_code?.trim() || "";
    if (!stopId || !stopName) continue;

    const lat = row.stop_lat ? Number.parseFloat(row.stop_lat) : null;
    const lon = row.stop_lon ? Number.parseFloat(row.stop_lon) : null;
    stopsById.set(stopId, {
      name: row.stop_name?.trim() || stopId,
      lat: Number.isNaN(lat ?? NaN) ? null : lat,
      lon: Number.isNaN(lon ?? NaN) ? null : lon,
    });

    const existing = stopIdsByStation.get(stopName) || [];
    if (!existing.includes(stopId)) {
      existing.push(stopId);
    }
    stopIdsByStation.set(stopName, existing);

    if (platformCode) {
      const platformKey = `${stopName}|${normalizeStationKey(platformCode)}`;
      const platformExisting = stopIdsByStationAndPlatform.get(platformKey) || [];
      if (!platformExisting.includes(stopId)) {
        platformExisting.push(stopId);
      }
      stopIdsByStationAndPlatform.set(platformKey, platformExisting);
    }
  }

  return {
    stopIdsByStation,
    stopIdsByStationAndPlatform,
    stopsById,
  };
}

function parseGtfsTransfers(rows: GtfsTransferRow[]) {
  const transferRules = new Map<string, { transferType: number; minTransferTimeSec: number | null }[]>();

  for (const row of rows) {
    const fromStopId = row.from_stop_id?.trim();
    const toStopId = row.to_stop_id?.trim();
    if (!fromStopId || !toStopId) continue;
    if (row.from_trip_id || row.to_trip_id || row.from_route_id || row.to_route_id) continue;

    const key = `${fromStopId}=>${toStopId}`;
    const existing = transferRules.get(key) || [];
    existing.push({
      transferType: parseInteger(row.transfer_type) ?? 2,
      minTransferTimeSec: parseInteger(row.min_transfer_time),
    });
    transferRules.set(key, existing);
  }

  return transferRules;
}

function extractGtfsZipUrl(sourceText: string): string | null {
  const absoluteMatch = sourceText.match(
    /href="(https:\/\/data\.opentransportdata\.swiss\/[^"]+?\.zip)"/i
  );
  if (absoluteMatch?.[1]) {
    return absoluteMatch[1].replace(/&amp;/g, "&");
  }

  const relativeMatch = sourceText.match(
    /href="([^"]+\/download\/[^"]+?\.zip)"/i
  );
  if (relativeMatch?.[1]) {
    return `https://data.opentransportdata.swiss${relativeMatch[1].replace(/&amp;/g, "&")}`;
  }

  const plainMatch = sourceText.match(
    /https:\/\/data\.opentransportdata\.swiss\/[^"'<>\\s]+\.zip/i
  );
  return plainMatch ? plainMatch[0].replace(/&amp;/g, "&") : null;
}

async function fetchSwissGtfsZipUrl(): Promise<string | null> {
  try {
    const pageResponse = await fetch(SWISS_GTFS_DATASET_PAGE_URL, {
      cache: "no-store",
    });

    if (!pageResponse.ok) return null;

    const pageHtml = await pageResponse.text();
    return extractGtfsZipUrl(pageHtml);
  } catch {
    return null;
  }
}

async function isFreshLocalGtfsCache(cachePath: string) {
  try {
    const fileStat = await stat(cachePath);
    const maxAgeMs = GTFS_CACHE_REVALIDATE_SECONDS * 1000;
    return Date.now() - fileStat.mtimeMs <= maxAgeMs;
  } catch {
    return false;
  }
}

async function ensureSwissGtfsZipOnDisk(): Promise<string | null> {
  await mkdir(GTFS_LOCAL_CACHE_DIR, { recursive: true });

  if (await isFreshLocalGtfsCache(GTFS_LOCAL_CACHE_PATH)) {
    return GTFS_LOCAL_CACHE_PATH;
  }

  const zipUrl = await fetchSwissGtfsZipUrl();
  if (!zipUrl) {
    return (await isFreshLocalGtfsCache(GTFS_LOCAL_CACHE_PATH)) ? GTFS_LOCAL_CACHE_PATH : null;
  }

  const response = await fetch(zipUrl, { cache: "no-store" });
  if (!response.ok || !response.body) {
    return (await isFreshLocalGtfsCache(GTFS_LOCAL_CACHE_PATH)) ? GTFS_LOCAL_CACHE_PATH : null;
  }

  const tempPath = `${GTFS_LOCAL_CACHE_PATH}.tmp`;
  try {
    await writeFile(tempPath, Buffer.from(await response.arrayBuffer()));
    await rename(tempPath, GTFS_LOCAL_CACHE_PATH);
    return GTFS_LOCAL_CACHE_PATH;
  } catch {
    try {
      await unlink(tempPath);
    } catch {
      // ignore cleanup failures
    }
    return (await isFreshLocalGtfsCache(GTFS_LOCAL_CACHE_PATH)) ? GTFS_LOCAL_CACHE_PATH : null;
  }
}

async function loadSwissGtfsTransferDataset(): Promise<SwissGtfsTransferDataset | null> {
  if (swissGtfsTransferDatasetPromise) return swissGtfsTransferDatasetPromise;

  swissGtfsTransferDatasetPromise = (async () => {
    try {
      const zipPath = await ensureSwissGtfsZipOnDisk();
      if (!zipPath) return null;

      const zip = await JSZip.loadAsync(await readFile(zipPath));
      const stopsFile = zip.file("stops.txt");
      const transfersFile = zip.file("transfers.txt");
      if (!stopsFile || !transfersFile) return null;

      const [stopsText, transfersText] = await Promise.all([
        stopsFile.async("string"),
        transfersFile.async("string"),
      ]);

      const stopIndex = parseGtfsStops(parseCsvText(stopsText) as GtfsStopRow[]);
      const transferRules = parseGtfsTransfers(parseCsvText(transfersText) as GtfsTransferRow[]);

      return { ...stopIndex, transferRules };
    } catch {
      return null;
    }
  })();

  return swissGtfsTransferDatasetPromise;
}

function isVehicleLeg(leg: Leg | null | undefined) {
  return Boolean(
    leg &&
    (leg.category?.trim() || (leg.number && leg.number !== "–"))
  );
}

function getDisplayLegs(legs: Leg[] | undefined) {
  return (legs || []).filter(isVehicleLeg);
}

function getSwissClockMinutes(isoTime: string): number | null {
  const trimmed = isoTime.trim();
  const localParts = hasExplicitTimezone(trimmed) ? null : parseSwissLocalDateTime(trimmed);
  if (localParts) {
    return localParts.hours * 60 + localParts.minutes;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SWISS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const hours = Number.parseInt(parts.find((part) => part.type === "hour")?.value || "", 10);
  const minutes = Number.parseInt(parts.find((part) => part.type === "minute")?.value || "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesBetweenClockTimes(start: string, end: string): number | null {
  const startMinutes = parseTimeMinutes(start);
  const endMinutes = parseTimeMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 24 * 60 - startMinutes;
}

function getPlatformCode(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^(gleis|platform|kante|quai|stand|steg|pier)\s*/i, "");
  const match = withoutPrefix.match(/[0-9]+[a-z]?|[a-z]+(?:-[a-z]+)?/i);
  return match ? match[0].trim() : "";
}

function getCandidateStopIds(dataset: SwissGtfsTransferDataset | null, stationName: string, platformCode?: string) {
  if (!dataset) return [];
  const stationKey = normalizeStationKey(stationName);
  const exactPlatformKey = platformCode ? `${stationKey}|${normalizeStationKey(platformCode)}` : "";

  if (exactPlatformKey) {
    const exactIds = dataset.stopIdsByStationAndPlatform.get(exactPlatformKey);
    if (exactIds && exactIds.length > 0) {
      return exactIds;
    }
  }

  return dataset.stopIdsByStation.get(stationKey) || [];
}

function getStopCoords(
  dataset: SwissGtfsTransferDataset | null,
  stopId: string
): { lat: number; lon: number } | null {
  if (!dataset) return null;
  const stop = dataset.stopsById.get(stopId);
  if (!stop || stop.lat === null || stop.lon === null) return null;
  return { lat: stop.lat, lon: stop.lon };
}

function getStopName(
  dataset: SwissGtfsTransferDataset | null,
  stopId: string
): string | null {
  if (!dataset) return null;
  const stop = dataset.stopsById.get(stopId);
  if (!stop || !stop.name) return null;
  return stop.name;
}

function getWalkRouteCacheKey(
  fromCoords: { lat: number; lon: number },
  toCoords: { lat: number; lon: number }
) {
  return [
    fromCoords.lat.toFixed(6),
    fromCoords.lon.toFixed(6),
    toCoords.lat.toFixed(6),
    toCoords.lon.toFixed(6),
  ].join(":");
}

function routeWalkingDistanceToMinutes(distanceMeters: number) {
  return Math.ceil(distanceMeters / WALKING_METERS_PER_MINUTE) + WALKING_BUFFER_MINUTES;
}

async function estimateWalkingRouteBetweenCoords(
  fromCoords: { lat: number; lon: number },
  toCoords: { lat: number; lon: number }
): Promise<{ distanceMeters: number; minutes: number } | null> {
  const cacheKey = getWalkRouteCacheKey(fromCoords, toCoords);
  const cached = walkingRouteEstimateCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const url = new URL(WALKING_ROUTE_BASE_URL);
      url.pathname += `/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}`;
      url.searchParams.set("overview", "false");
      url.searchParams.set("steps", "false");
      url.searchParams.set("alternatives", "false");

      const response = await fetch(url.toString(), {
        next: { revalidate: WALKING_ROUTE_REVALIDATE_SECONDS },
      });
      if (!response.ok) return null;

      const data = await response.json() as {
        code?: string;
        routes?: Array<{ distance?: number }>;
      };

      if (data.code !== "Ok") return null;

      const distanceMeters = data.routes?.[0]?.distance;
      if (typeof distanceMeters !== "number" || Number.isNaN(distanceMeters) || distanceMeters <= 0) {
        return null;
      }

      return {
        distanceMeters,
        minutes: routeWalkingDistanceToMinutes(distanceMeters),
      };
    } catch {
      return null;
    }
  })();

  walkingRouteEstimateCache.set(cacheKey, pending);
  return pending;
}

function haversineDistanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

async function estimateWalkingMinutesBetweenStops(
  dataset: SwissGtfsTransferDataset | null,
  fromIds: string[],
  toIds: string[]
): Promise<{ distanceMeters: number; minutes: number } | null> {
  if (!dataset || fromIds.length === 0 || toIds.length === 0) return null;

  let bestEstimate: { distanceMeters: number; minutes: number } | null = null;

  for (const fromId of fromIds) {
    const fromCoords = getStopCoords(dataset, fromId);
    if (!fromCoords) continue;

    for (const toId of toIds) {
      const toCoords = getStopCoords(dataset, toId);
      if (!toCoords) continue;

      const routeEstimate = await estimateWalkingRouteBetweenCoords(fromCoords, toCoords);
      if (routeEstimate) {
        if (bestEstimate === null || routeEstimate.minutes < bestEstimate.minutes) {
          bestEstimate = routeEstimate;
        }
        continue;
      }

      const meters = haversineDistanceMeters(fromCoords, toCoords);
      const fallbackEstimate = {
        distanceMeters: meters,
        minutes: routeWalkingDistanceToMinutes(meters),
      };
      if (bestEstimate === null || fallbackEstimate.minutes < bestEstimate.minutes) {
        bestEstimate = fallbackEstimate;
      }
    }
  }

  return bestEstimate;
}

function getTransferRule(
  dataset: SwissGtfsTransferDataset | null,
  fromStation: string,
  toStation: string,
  fromPlatform?: string,
  toPlatform?: string
): { transferType: number; minTransferTimeSec: number | null } | null {
  if (!dataset) return null;

  const fromIds = getCandidateStopIds(dataset, fromStation, getPlatformCode(fromPlatform));
  const toIds = getCandidateStopIds(dataset, toStation, getPlatformCode(toPlatform));
  if (fromIds.length === 0 || toIds.length === 0) return null;

  let bestRule: { transferType: number; minTransferTimeSec: number | null } | null = null;

  for (const fromId of fromIds) {
    for (const toId of toIds) {
      const rules = dataset.transferRules.get(`${fromId}=>${toId}`) || [];
      for (const rule of rules) {
        if (bestRule === null) {
          bestRule = rule;
          continue;
        }

        const currentRequired = rule.transferType === 4
          ? 0
          : rule.transferType === 1
            ? 0
            : Math.ceil((rule.minTransferTimeSec ?? 0) / 60);
        const bestRequired = bestRule.transferType === 4
          ? 0
          : bestRule.transferType === 1
            ? 0
            : Math.ceil((bestRule.minTransferTimeSec ?? 0) / 60);

        if (currentRequired > bestRequired) {
          bestRule = rule;
        }
      }
    }
  }

  return bestRule;
}

async function estimateRequiredTransferMinutes(
  currentLeg: Leg,
  nextLeg: Leg,
  walkMinutes: number | null,
  dataset: SwissGtfsTransferDataset | null
) {
  const fromIds = getCandidateStopIds(dataset, currentLeg.arrivalStation, getPlatformCode(currentLeg.arrivalPlatform));
  const toIds = getCandidateStopIds(dataset, nextLeg.departureStation, getPlatformCode(nextLeg.departurePlatform));

  const transferRule = getTransferRule(
    dataset,
    currentLeg.arrivalStation,
    nextLeg.departureStation,
    currentLeg.arrivalPlatform,
    nextLeg.departurePlatform
  );
  if (transferRule) {
    if (transferRule.transferType === 4 || transferRule.transferType === 1) {
      return 0;
    }

    if (transferRule.minTransferTimeSec !== null) {
      return Math.ceil(transferRule.minTransferTimeSec / 60);
    }
  }

  const walkingEstimate = await estimateWalkingMinutesBetweenStops(dataset, fromIds, toIds);
  if (walkingEstimate !== null) {
    return Math.max(DEFAULT_TRANSFER_MINUTES, walkingEstimate.minutes);
  }

  if (walkMinutes !== null) {
    return Math.max(DEFAULT_TRANSFER_MINUTES, walkMinutes);
  }

  return DEFAULT_TRANSFER_MINUTES;
}

async function assessTransferTiming(
  connection: Connection,
  displayLegs: Leg[],
  idx: number,
  dataset: SwissGtfsTransferDataset | null
): Promise<TransferAssessment | null> {
  const currentLeg = displayLegs[idx];
  const nextLeg = displayLegs[idx + 1];
  if (!currentLeg || !nextLeg) return null;

  const allLegs = Array.isArray(connection?.legs) ? connection.legs : [];
  const currentIndex = allLegs.indexOf(currentLeg);
  const nextIndex = allLegs.indexOf(nextLeg);
  if (currentIndex < 0 || nextIndex <= currentIndex) return null;

  const betweenLegs = allLegs.slice(currentIndex + 1, nextIndex);
  const walkLegs = betweenLegs.filter((leg) => !isVehicleLeg(leg));
  const givenMinutes = minutesBetweenClockTimes(currentLeg.arrivalTime, nextLeg.departureTime);
  let walkMinutes: number | null = null;
  for (const leg of walkLegs) {
    const legMinutes = minutesBetweenClockTimes(leg.departureTime, leg.arrivalTime);
    if (legMinutes === null) continue;
    walkMinutes = (walkMinutes ?? 0) + legMinutes;
  }

  const requiredMinutes = await estimateRequiredTransferMinutes(currentLeg, nextLeg, walkMinutes, dataset);

  if (givenMinutes === null) {
    return {
      givenMinutes: null,
      requiredMinutes,
      slackMinutes: null,
      walkMinutes,
      walkDistanceMeters: null,
      tone: "unknown",
    };
  }

  const slackMinutes = givenMinutes - requiredMinutes;

  let tone: TransferAssessment["tone"] = "plenty";
  if (slackMinutes < 0) {
    tone = "tight";
  } else if (slackMinutes <= 3) {
    tone = "tight";
  } else if (slackMinutes <= 8) {
    tone = "okay";
  }

  return {
    givenMinutes,
    requiredMinutes,
    slackMinutes,
    walkMinutes,
    walkDistanceMeters: null,
    tone,
  };
}

async function buildTransferAssessments(
  connection: Connection,
  dataset: SwissGtfsTransferDataset | null
): Promise<TransferAssessment[]> {
  const displayLegs = getDisplayLegs(connection.legs);
  if (displayLegs.length < 2) return [];
  return Promise.all(displayLegs
    .slice(0, -1)
    .map((_, idx) => assessTransferTiming(connection, displayLegs, idx, dataset))
  ).then((items) => items.filter((item): item is TransferAssessment => Boolean(item)));
}

export async function calculateTransferAssessments(
  connection: Connection,
  dataset: SwissGtfsTransferDataset | null
): Promise<TransferAssessment[]> {
  return buildTransferAssessments(connection, dataset);
}

async function buildEndpointAssessment(
  connection: Connection,
  dataset: SwissGtfsTransferDataset | null,
  side: "start" | "end"
): Promise<TransferAssessment | null> {
  const displayLegs = getDisplayLegs(connection.legs);
  if (displayLegs.length === 0) return null;

  const allLegs = Array.isArray(connection?.legs) ? connection.legs : [];
  const anchorLeg = side === "start" ? displayLegs[0] : displayLegs[displayLegs.length - 1];
  const anchorIndex = allLegs.indexOf(anchorLeg);
  if (anchorIndex < 0) return null;

  const boundaryLegs = side === "start"
    ? allLegs.slice(0, anchorIndex)
    : allLegs.slice(anchorIndex + 1);
  const walkLegs = boundaryLegs.filter((leg) => !isVehicleLeg(leg));

  const givenMinutes = side === "start"
    ? minutesBetweenClockTimes(connection.departure, anchorLeg.departureTime)
    : minutesBetweenClockTimes(anchorLeg.arrivalTime, connection.arrival);
  let walkMinutes: number | null = null;
  for (const leg of walkLegs) {
    const legMinutes = minutesBetweenClockTimes(leg.departureTime, leg.arrivalTime);
    if (legMinutes === null) continue;
    walkMinutes = (walkMinutes ?? 0) + legMinutes;
  }

  const targetCoords = side === "start"
    ? connection.accessTargetCoords ?? null
    : connection.destinationTargetCoords ?? null;

  if (walkLegs.length === 0 && !targetCoords) return null;

  let routeEstimate: { distanceMeters: number; minutes: number } | null = null;
  if (targetCoords && dataset) {
    const stationName = side === "start" ? anchorLeg.departureStation : anchorLeg.arrivalStation;
    const stationPlatform = side === "start" ? getPlatformCode(anchorLeg.departurePlatform) : getPlatformCode(anchorLeg.arrivalPlatform);
    const stationIds = getCandidateStopIds(dataset, stationName, stationPlatform);

    let bestEstimate: { distanceMeters: number; minutes: number } | null = null;
    for (const stopId of stationIds) {
      const stationCoords = getStopCoords(dataset, stopId);
      if (!stationCoords) continue;

      const candidateRoute = side === "start"
        ? await estimateWalkingRouteBetweenCoords(targetCoords, stationCoords)
        : await estimateWalkingRouteBetweenCoords(stationCoords, targetCoords);
      if (candidateRoute) {
        if (bestEstimate === null || candidateRoute.minutes < bestEstimate.minutes) {
          bestEstimate = candidateRoute;
        }
        continue;
      }

      const meters = haversineDistanceMeters(stationCoords, targetCoords);
      const fallbackEstimate = {
        distanceMeters: meters,
        minutes: routeWalkingDistanceToMinutes(meters),
      };
      if (bestEstimate === null || fallbackEstimate.minutes < bestEstimate.minutes) {
        bestEstimate = fallbackEstimate;
      }
    }

    routeEstimate = bestEstimate;
  } else {
    const fromStation = side === "start" ? connection.from : anchorLeg.arrivalStation;
    const toStation = side === "start" ? anchorLeg.departureStation : connection.to;
    const fromPlatform = side === "start" ? undefined : getPlatformCode(anchorLeg.arrivalPlatform);
    const toPlatform = side === "start" ? getPlatformCode(anchorLeg.departurePlatform) : undefined;
    const fromIds = getCandidateStopIds(dataset, fromStation, fromPlatform);
    const toIds = getCandidateStopIds(dataset, toStation, toPlatform);
    routeEstimate = await estimateWalkingMinutesBetweenStops(dataset, fromIds, toIds);
  }

  const requiredMinutes = routeEstimate
    ? Math.max(DEFAULT_TRANSFER_MINUTES, routeEstimate.minutes)
    : walkMinutes !== null
      ? Math.max(DEFAULT_TRANSFER_MINUTES, walkMinutes)
      : DEFAULT_TRANSFER_MINUTES;

  if (givenMinutes === null) {
    return {
      givenMinutes: null,
      requiredMinutes,
      slackMinutes: null,
      walkMinutes,
      walkDistanceMeters: routeEstimate?.distanceMeters ?? null,
      tone: "unknown",
    };
  }

  const slackMinutes = givenMinutes - requiredMinutes;

  let tone: TransferAssessment["tone"] = "plenty";
  if (slackMinutes < 0) {
    tone = "tight";
  } else if (slackMinutes <= 3) {
    tone = "tight";
  } else if (slackMinutes <= 8) {
    tone = "okay";
  }

  return {
    givenMinutes,
    requiredMinutes,
    slackMinutes,
    walkMinutes,
    walkDistanceMeters: routeEstimate?.distanceMeters ?? null,
    tone,
  };
}

export async function calculateAccessAssessment(
  connection: Connection,
  dataset: SwissGtfsTransferDataset | null
): Promise<TransferAssessment | null> {
  return buildEndpointAssessment(connection, dataset, "start");
}

export async function calculateDestinationAssessment(
  connection: Connection,
  dataset: SwissGtfsTransferDataset | null
): Promise<TransferAssessment | null> {
  return buildEndpointAssessment(connection, dataset, "end");
}

export async function loadTransferDatasetFromSwissGtfs(): Promise<SwissGtfsTransferDataset | null> {
  return loadSwissGtfsTransferDataset();
}

function hasRealtimeCheckpointData(
  checkpoint?: {
    delay?: number | null;
    prognosis?: {
      platform?: string | null;
      arrival?: string | null;
      departure?: string | null;
    };
    realtimeAvailability?: unknown;
    cancelled?: boolean | null;
    canceled?: boolean | null;
  }
): boolean {
  if (!checkpoint) return false;

  return (
    typeof checkpoint.delay === "number" ||
    Boolean(checkpoint.prognosis?.platform) ||
    Boolean(checkpoint.prognosis?.arrival) ||
    Boolean(checkpoint.prognosis?.departure) ||
    checkpoint.realtimeAvailability != null ||
    checkpoint.cancelled === true ||
    checkpoint.canceled === true
  );
}

/**
 * Search for train connections between two stations
 */
export async function searchConnections(
  fromStation: string,
  toStation: string,
  date: string,
  time: string,
  isArrival: boolean = false,
  page: number = INITIAL_RESULTS_PAGE,
  applyInitialTimeFilter: boolean = true,
  limit: number = 6
): Promise<SearchResult> {
  const requestedPage = Math.min(Math.max(Math.trunc(page), 0), MAX_CONNECTION_PAGE);
  const requestedLimit = Math.min(Math.max(Math.trunc(limit), 1), 16);
  const pageFlags = {
    page: requestedPage,
    hasMoreBefore: requestedPage > 0,
    hasMoreAfter: requestedPage < MAX_CONNECTION_PAGE,
  };

  if (!fromStation || !toStation || !date || !time) {
    return {
      connections: [],
      from: fromStation,
      to: toStation,
      ...pageFlags,
      error: "Missing required parameters",
    };
  }

  const requestedMinutes = parseTimeMinutes(time);
  const transferDataset = await loadSwissGtfsTransferDataset();
  const fromTarget = await resolveLocationTarget(fromStation, transferDataset);
  const toTarget = await resolveLocationTarget(toStation, transferDataset);
  const upstreamLimit = Math.max(requestedLimit, 16);

  async function fetchAndBuildConnections(searchTime: string, arrivalTimeSearch: boolean) {
    const apiIsArrivalTime = arrivalTimeSearch ? "1" : "0";
    const params = new URLSearchParams({
      from: fromTarget.routingQuery || fromStation.trim(),
      to: toTarget.routingQuery || toStation.trim(),
      date: date,
      time: searchTime,
      isArrivalTime: apiIsArrivalTime,
      limit: String(upstreamLimit),
      page: String(requestedPage),
    });

    const url = `https://transport.opendata.ch/v1/connections?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        connections: [] as Connection[],
        error: `Failed to fetch connections: ${response.statusText}`,
      };
    }

    const data = await response.json() as ApiConnectionsResponse;

    const connections: Connection[] = await Promise.all((data.connections || []).map(async (c) => {
      const departure = c.from.departure;
      const arrival = c.to.arrival;

      const durationMs = new Date(arrival).getTime() - new Date(departure).getTime();
      const durationStr = parseDuration(
        `PT${Math.floor(durationMs / 3600000)}H${Math.floor((durationMs % 3600000) / 60000)}M`
      );

      const sectionsArray = Array.isArray(c.sections) ? c.sections : [];
      const numChanges = c.transfers ?? (sectionsArray.length > 1 ? sectionsArray.length - 1 : 0);

      function normalizeTrainNumber(value?: string): string {
        if (!value) return "–";
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? value : String(parsed);
      }

      const connection: Connection = {
        from: fromTarget.displayLabel || c.from.station.name,
        to: toTarget.displayLabel || c.to.station.name,
        departure: formatTime(departure),
        arrival: formatTime(arrival),
        departureIso: departure,
        arrivalIso: arrival,
        duration: durationStr,
        changes: numChanges,
        platform: c.from.platform,
        legs: sectionsArray.map((section) => {
          const journey = section.journey || {};
          const departure = section.departure;
          const arrival = section.arrival;
          const departureCancelled = departure?.cancelled === true || departure?.canceled === true;
          const arrivalCancelled = arrival?.cancelled === true || arrival?.canceled === true;
          return {
            number: normalizeTrainNumber(journey.number || journey.name || "–"),
            category: journey.category || "",
            direction: journey.to || "",
            departureTime: formatTime(departure?.departure || journey.departure),
            arrivalTime: formatTime(arrival?.arrival || journey.arrival),
            departureStation: departure?.station?.name || "–",
            arrivalStation: arrival?.station?.name || "–",
            departurePlatform: departure?.platform || undefined,
            arrivalPlatform: arrival?.platform || undefined,
            departureDelay: typeof departure?.delay === "number" ? departure.delay : undefined,
            arrivalDelay: typeof arrival?.delay === "number" ? arrival.delay : undefined,
            departurePrognosisTime: departure?.prognosis?.departure ? formatTime(departure.prognosis.departure) : undefined,
            arrivalPrognosisTime: arrival?.prognosis?.arrival ? formatTime(arrival.prognosis.arrival) : undefined,
            departurePrognosisPlatform: departure?.prognosis?.platform || undefined,
            arrivalPrognosisPlatform: arrival?.prognosis?.platform || undefined,
            cancelled: departureCancelled || arrivalCancelled,
            hasRealtimeData: hasRealtimeCheckpointData(departure) || hasRealtimeCheckpointData(arrival),
          };
        }),
        accessTargetCoords: fromTarget.targetCoords,
        destinationTargetCoords: toTarget.targetCoords,
      };

      connection.transferAssessments = await buildTransferAssessments(connection, transferDataset);
      connection.accessAssessment = await calculateAccessAssessment(connection, transferDataset);
      connection.destinationAssessment = await calculateDestinationAssessment(connection, transferDataset);
      return connection;
    }));

    return { connections };
  }

  function filterConnectionsByQuery(
    connections: Connection[],
    filterDate: string,
    filterMinutes: number | null,
    arrivalFilter: boolean
  ) {
    const filteredConnections = connections.filter((connection) => {
      const departureDate = getSwissDateKey(connection.departureIso);
      const arrivalDate = getSwissDateKey(connection.arrivalIso);
      const departureTime = new Date(connection.departureIso).getTime();
      const arrivalTime = new Date(connection.arrivalIso).getTime();

      if (departureDate === null || arrivalDate === null || Number.isNaN(departureTime) || Number.isNaN(arrivalTime)) {
        return true;
      }

      if (arrivalFilter) {
        if (arrivalDate !== filterDate) {
          return false;
        }
      } else if (departureDate !== filterDate) {
        return false;
      }

      const relevantMinutes = arrivalFilter
        ? getSwissClockMinutes(connection.arrivalIso)
        : getSwissClockMinutes(connection.departureIso);

      if (relevantMinutes === null) {
        return true;
      }

      if (!applyInitialTimeFilter || filterMinutes === null) {
        return true;
      }

      return arrivalFilter
        ? relevantMinutes <= filterMinutes
        : relevantMinutes >= filterMinutes;
    });

    filteredConnections.sort((a, b) => {
      const aTime = new Date(a.departureIso).getTime();
      const bTime = new Date(b.departureIso).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });

    return filteredConnections;
  }

  try {
    const initialSearch = await fetchAndBuildConnections(time, isArrival);
    let filteredConnections = filterConnectionsByQuery(
      initialSearch.connections,
      date,
      requestedMinutes,
      isArrival
    );

    if (filteredConnections.length === 0 && isArrival && requestedMinutes !== null) {
      const fallbackOffsets = [180, 120, 90, 60, 40, 20];
      const seenKeys = new Set<string>();
      const fallbackConnections: Connection[] = [];

      for (const offset of fallbackOffsets) {
        const shifted = shiftSwissDateTime(date, time, -offset);
        if (!shifted) continue;

        const fallbackSearch = await fetchAndBuildConnections(shifted.time, false);
        const fallbackFiltered = filterConnectionsByQuery(
          fallbackSearch.connections,
          date,
          requestedMinutes,
          true
        ).filter((connection) => {
          const arrivalMinutes = getSwissClockMinutes(connection.arrivalIso);
          return arrivalMinutes !== null && arrivalMinutes <= requestedMinutes;
        });

        for (const connection of fallbackFiltered) {
          const key = `${connection.departureIso}|${connection.arrivalIso}|${connection.from}|${connection.to}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          fallbackConnections.push(connection);
        }
      }

      fallbackConnections.sort((a, b) => {
        const aTime = new Date(a.departureIso).getTime();
        const bTime = new Date(b.departureIso).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
        return aTime - bTime;
      });

      if (fallbackConnections.length > 0) {
        filteredConnections = fallbackConnections;
      }
    }

    return {
      connections: filteredConnections.slice(0, requestedLimit),
      from: fromStation,
      to: toStation,
      ...pageFlags,
    };
  } catch (error) {
    return {
      connections: [],
      from: fromStation,
      to: toStation,
      ...pageFlags,
      error: `Error fetching connections: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
