"use server";

import { createTranslator, getLocaleTag, normalizeLanguage } from "@/lib/i18n";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

// MeteoSwiss OGD Local Forecast data
// See: https://opendatadocs.meteoswiss.ch/e4-local-forecast-model-data/e4-local-forecast-model-data

const STAC_ITEMS_URL =
  "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items?limit=10";
const META_POINTS_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_point.csv";
const META_POINTS_TTL_MS = 60 * 60 * 1000;
const WEATHER_TTL_MS = 60 * 60 * 1000;
const REMOTE_FETCH_TIMEOUT_MS = Number(process.env.SENIORNETT_WEATHER_FETCH_TIMEOUT_MS || 8000);
const WEATHER_CACHE_DIR = path.join(process.cwd(), ".cache", "seniornett-weather");

// Zürich / Fluntern station point_id available across all required parameters
const ZURICH_POINT_ID = "71";
const ZURICH_NAME = "Zürich";

interface MetaPoint {
  pointId: string;
  pointTypeId: string;
  postalCode: string;
  pointName: string;
  lat: number;
  lon: number;
}

type MetaPointCache = {
  expiresAt: number;
  promise: Promise<MetaPoint[]> | null;
  value: MetaPoint[] | null;
};

const metaPointsCache: MetaPointCache = {
  expiresAt: 0,
  promise: null,
  value: null,
};

type WeatherCacheEntry = {
  expiresAt: number;
  promise: Promise<WeatherResult> | null;
  value: WeatherResult | null;
};

const weatherCache = new Map<string, WeatherCacheEntry>();

type DiskCacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

async function ensureWeatherCacheDir(): Promise<void> {
  await mkdir(WEATHER_CACHE_DIR, { recursive: true });
}

function cacheFilePath(kind: string, key: string): string {
  const hash = createHash("sha1").update(`${kind}:${key}`).digest("hex");
  return path.join(WEATHER_CACHE_DIR, `${kind}-${hash}.json`);
}

async function readDiskCache<T>(kind: string, key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await readFile(cacheFilePath(kind, key), "utf8");
    const envelope = JSON.parse(raw) as DiskCacheEnvelope<T>;
    if (!envelope || typeof envelope.savedAt !== "number" || Date.now() - envelope.savedAt > ttlMs) {
      return null;
    }
    return envelope.value ?? null;
  } catch {
    return null;
  }
}

async function writeDiskCache<T>(kind: string, key: string, value: T): Promise<void> {
  try {
    await ensureWeatherCacheDir();
    const envelope: DiskCacheEnvelope<T> = { savedAt: Date.now(), value };
    await writeFile(cacheFilePath(kind, key), JSON.stringify(envelope), "utf8");
  } catch {
    // Ignore cache write failures.
  }
}

async function fetchTextWithTimeout(url: string, init: RequestInit = {}, timeoutMs = REMOTE_FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = REMOTE_FETCH_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArrayBufferWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REMOTE_FETCH_TIMEOUT_MS
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

function hasCoordinates(point: MetaPoint): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon);
}

function iconForCode(code: number, t: ReturnType<typeof createTranslator>): { emoji: string; label: string } {
  const iconMap: Record<number, { emoji: string; label: string }> = {
    1: { emoji: "☀️", label: t("weather.conditions.sunny") },
    2: { emoji: "🌤️", label: t("weather.conditions.partlyCloudy") },
    3: { emoji: "⛅", label: t("weather.conditions.mixed") },
    4: { emoji: "🌥️", label: t("weather.conditions.cloudy") },
    5: { emoji: "☁️", label: t("weather.conditions.overcast") },
    8: { emoji: "🌫️", label: t("weather.conditions.highFog") },
    9: { emoji: "🌫️", label: t("weather.conditions.fog") },
    10: { emoji: "🌫️", label: t("weather.conditions.fog") },
    11: { emoji: "🌦️", label: t("weather.conditions.lightShowers") },
    12: { emoji: "🌦️", label: t("weather.conditions.showers") },
    13: { emoji: "🌧️", label: t("weather.conditions.showers") },
    14: { emoji: "🌧️", label: t("weather.conditions.rainShowers") },
    17: { emoji: "🌧️", label: t("weather.conditions.rain") },
    18: { emoji: "🌧️", label: t("weather.conditions.heavyRain") },
    19: { emoji: "🌧️", label: t("weather.conditions.strongRain") },
    20: { emoji: "🌧️", label: t("weather.conditions.downpour") },
    21: { emoji: "⛈️", label: t("weather.conditions.thunderstorm") },
    23: { emoji: "⛈️", label: t("weather.conditions.thunderstorm") },
    24: { emoji: "⛈️", label: t("weather.conditions.severeThunderstorm") },
    25: { emoji: "⛈️", label: t("weather.conditions.hailThunderstorm") },
    27: { emoji: "🌨️", label: t("weather.conditions.snowShowers") },
    28: { emoji: "❄️", label: t("weather.conditions.snow") },
    29: { emoji: "❄️", label: t("weather.conditions.snowfall") },
    30: { emoji: "🌨️", label: t("weather.conditions.sleet") },
    31: { emoji: "🌨️", label: t("weather.conditions.sleet") },
    32: { emoji: "❄️", label: t("weather.conditions.snowfall") },
    33: { emoji: "❄️", label: t("weather.conditions.heavySnow") },
    34: { emoji: "🌩️", label: t("weather.conditions.winterThunderstorm") },
  };

  if (iconMap[code]) return iconMap[code];
  // Fallback by range
  if (code >= 1 && code <= 5) return { emoji: "☁️", label: t("weather.conditions.genericCloudy") };
  if (code >= 6 && code <= 10) return { emoji: "🌫️", label: t("weather.conditions.genericFog") };
  if (code >= 11 && code <= 20) return { emoji: "🌧️", label: t("weather.conditions.genericPrecipitation") };
  if (code >= 21 && code <= 26) return { emoji: "⛈️", label: t("weather.conditions.thunderstorm") };
  if (code >= 27 && code <= 40) return { emoji: "❄️", label: t("weather.conditions.genericSnow") };
  return { emoji: "🌡️", label: t("weather.conditions.unknown") };
}

function parseCsvMap(text: string, pointId: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(";");
    if (parts.length >= 4 && parts[0] === pointId) {
      const val = parseFloat(parts[3]);
      if (!isNaN(val)) {
        map.set(parts[2], val);
      }
    }
  }
  return map;
}

function formatDayLabel(dateKey: string, localeTag: string): string {
  // dateKey is YYYYMMDDHHMM
  const year = parseInt(dateKey.slice(0, 4));
  const month = parseInt(dateKey.slice(4, 6)) - 1;
  const day = parseInt(dateKey.slice(6, 8));
  const d = new Date(Date.UTC(year, month, day));
  return d.toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatHourLabel(dateKey: string, localeTag: string): string {
  const year = parseInt(dateKey.slice(0, 4));
  const month = parseInt(dateKey.slice(4, 6)) - 1;
  const day = parseInt(dateKey.slice(6, 8));
  const hour = parseInt(dateKey.slice(8, 10));
  const minute = parseInt(dateKey.slice(10, 12));
  const d = new Date(Date.UTC(year, month, day, hour, minute));
  return new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Zurich",
  }).format(d);
}

function buildHourlySeries(
  datePrefix: string,
  localeTag: string,
  t: ReturnType<typeof createTranslator>,
  tempMap: Map<string, number>,
  precipMap: Map<string, number>,
  sunshineMap: Map<string, number>,
  windSpeedMap: Map<string, number>,
  windGustMap: Map<string, number>,
  windDirectionMap: Map<string, number>,
  iconMap: Map<string, number>
): DayHourlyForecast[] {
  const keys = new Set<string>([
    ...tempMap.keys(),
    ...precipMap.keys(),
    ...sunshineMap.keys(),
    ...windSpeedMap.keys(),
    ...windGustMap.keys(),
    ...windDirectionMap.keys(),
    ...iconMap.keys(),
  ]);

  return [...keys]
    .filter((key) => key.startsWith(datePrefix))
    .sort()
    .map((key) => {
      const iconInfo = iconForCode(Math.round(iconMap.get(key) ?? 0), t);
      return {
        time: formatHourLabel(key, localeTag),
        label: iconInfo.label,
        emoji: iconInfo.emoji,
        temp: tempMap.has(key) ? Math.round(tempMap.get(key) ?? 0) : undefined,
        precipMm: precipMap.has(key) ? Math.round((precipMap.get(key) ?? 0) * 10) / 10 : undefined,
        sunshinePct: sunshineMap.has(key)
          ? Math.max(0, Math.min(100, Math.round(((sunshineMap.get(key) ?? 0) / 60) * 100)))
          : undefined,
        windSpeed: windSpeedMap.has(key) ? Math.round(windSpeedMap.get(key) ?? 0) : undefined,
        windGust: windGustMap.has(key) ? Math.round(windGustMap.get(key) ?? 0) : undefined,
        windDirection: windDirectionMap.has(key) ? Math.round(windDirectionMap.get(key) ?? 0) : undefined,
        snow: iconInfo.emoji === "❄️" || iconInfo.emoji === "🌨️",
      };
    });
}

export interface DayForecast {
  date: string;
  dayLabel: string;
  tempMin: number;
  tempMax: number;
  precipMm: number;
  emoji: string;
  label: string;
  hourly?: DayHourlyForecast[];
}

export interface WeatherResult {
  city: string;
  days: DayForecast[];
  error?: string;
}

export interface DayHourlyForecast {
  time: string;
  label: string;
  emoji: string;
  temp?: number;
  precipMm?: number;
  sunshinePct?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  snow?: boolean;
}

interface ResolvedPoint {
  pointId: string;
  cityName: string;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
}

interface SelectedAssets {
  minUrl: string;
  maxUrl: string;
  precipUrl: string | null;
  iconUrl: string;
  hourlyTempUrl: string | null;
  hourlyPrecipUrl: string | null;
  hourlySunshineUrl: string | null;
  windSpeedUrl: string | null;
  windGustUrl: string | null;
  windDirectionUrl: string | null;
  hourlyIconUrl: string | null;
  iconParam: "jp2000d0" | "jww003i0";
}

export type WeatherFetchOptions = {
  includeHourly?: boolean;
};

async function findAssetUrl(
  assets: Record<string, { href: string }>,
  paramCode: string
): Promise<string | null> {
  const keys = Object.keys(assets).filter((k) =>
    k.endsWith(`.${paramCode}.csv`)
  );
  if (keys.length === 0) return null;
  keys.sort();
  return assets[keys[keys.length - 1]].href;
}

async function selectLatestUsableAssets(
  features: Array<{ assets?: Record<string, { href: string }> }>
): Promise<SelectedAssets | null> {
  for (let i = features.length - 1; i >= 0; i--) {
    const assets: Record<string, { href: string }> = features[i]?.assets ?? {};

    const [minUrl, maxUrl, precipUrl, dailyIconUrl, hourlyTempUrl, hourlyPrecipUrl, hourlySunshineUrl, windSpeedUrl, windGustUrl, windDirectionUrl, hourlyIconUrl] = await Promise.all([
      findAssetUrl(assets, "tre200dn"),
      findAssetUrl(assets, "tre200dx"),
      findAssetUrl(assets, "rka150d0"),
      findAssetUrl(assets, "jp2000d0"),
      findAssetUrl(assets, "tre200h0"),
      findAssetUrl(assets, "rre150h0"),
      findAssetUrl(assets, "sre000h0"),
      findAssetUrl(assets, "fu3010h0"),
      findAssetUrl(assets, "fu3010h1"),
      findAssetUrl(assets, "dkl010h0"),
      findAssetUrl(assets, "jww003i0"),
    ]);

    if (!minUrl || !maxUrl) {
      continue;
    }

    if (dailyIconUrl) {
      return {
        minUrl,
        maxUrl,
        precipUrl,
        iconUrl: dailyIconUrl,
        hourlyTempUrl,
        hourlyPrecipUrl,
        hourlySunshineUrl,
        windSpeedUrl,
        windGustUrl,
        windDirectionUrl,
        hourlyIconUrl,
        iconParam: "jp2000d0",
      };
    }

    if (hourlyIconUrl) {
      return {
        minUrl,
        maxUrl,
        precipUrl,
        iconUrl: hourlyIconUrl,
        hourlyTempUrl,
        hourlyPrecipUrl,
        hourlySunshineUrl,
        windSpeedUrl,
        windGustUrl,
        windDirectionUrl,
        hourlyIconUrl,
        iconParam: "jww003i0",
      };
    }
  }

  return null;
}

function parseHourlyIconCsvToDailyMap(text: string, pointId: string): Map<string, number> {
  const bestByDay = new Map<string, { score: number; value: number }>();
  const lines = text.split("\n");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(";");
    if (parts.length < 4 || parts[0] !== pointId) {
      continue;
    }

    const rawDate = parts[2];
    const value = parseFloat(parts[3]);
    if (!rawDate || isNaN(value) || rawDate.length < 12) {
      continue;
    }

    const dayKey = `${rawDate.slice(0, 8)}0000`;
    const hhmm = parseInt(rawDate.slice(8, 12), 10);
    const score = Math.abs(hhmm - 1200);
    const existing = bestByDay.get(dayKey);

    if (!existing || score < existing.score) {
      bestByDay.set(dayKey, { score, value });
    }
  }

  const dailyMap = new Map<string, number>();
  for (const [dayKey, data] of bestByDay.entries()) {
    dailyMap.set(dayKey, data.value);
  }
  return dailyMap;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMetaPoints(text: string): MetaPoint[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(";").map((part) => part.trim());
  const idxPointId = header.indexOf("point_id");
  const idxPointTypeId = header.indexOf("point_type_id");
  const idxPostalCode = header.indexOf("postal_code");
  const idxPointName = header.indexOf("point_name");
  const idxLat = header.indexOf("point_coordinates_wgs84_lat");
  const idxLon = header.indexOf("point_coordinates_wgs84_lon");

  if (
    idxPointId === -1 ||
    idxPointTypeId === -1 ||
    idxPostalCode === -1 ||
    idxPointName === -1
  ) {
    return [];
  }

  const points: MetaPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    if (cols.length <= idxPointName) continue;

    points.push({
      pointId: cols[idxPointId] ?? "",
      pointTypeId: cols[idxPointTypeId] ?? "",
      postalCode: cols[idxPostalCode] ?? "",
      pointName: cols[idxPointName] ?? "",
      lat: idxLat !== -1 ? parseFloat(cols[idxLat] ?? "0") : 0,
      lon: idxLon !== -1 ? parseFloat(cols[idxLon] ?? "0") : 0,
    });
  }

  return points;
}

async function loadMetaPoints(): Promise<MetaPoint[]> {
  const now = Date.now();
  if (metaPointsCache.value && metaPointsCache.expiresAt > now) {
    return metaPointsCache.value;
  }

  const cachedDiskPoints = await readDiskCache<MetaPoint[]>("meta-points", "all", META_POINTS_TTL_MS);
  if (cachedDiskPoints) {
    metaPointsCache.value = cachedDiskPoints;
    metaPointsCache.expiresAt = Date.now() + META_POINTS_TTL_MS;
    return cachedDiskPoints;
  }

  if (metaPointsCache.promise) {
    return metaPointsCache.promise;
  }

  metaPointsCache.promise = (async () => {
    const metaBuffer = await fetchArrayBufferWithTimeout(META_POINTS_URL, {
      next: { revalidate: 86400 },
    });
    const metaText = new TextDecoder("iso-8859-1").decode(metaBuffer);
    const points = parseMetaPoints(metaText);
    metaPointsCache.value = points;
    metaPointsCache.expiresAt = Date.now() + META_POINTS_TTL_MS;
    void writeDiskCache("meta-points", "all", points);
    return points;
  })();

  try {
    return await metaPointsCache.promise;
  } finally {
    metaPointsCache.promise = null;
  }
}

function weatherCacheKey(pointId: string, locale: string, includeHourly: boolean): string {
  return [pointId, locale, includeHourly ? "hourly" : "daily"].join(":");
}

function readCachedWeather(key: string): WeatherResult | null {
  const entry = weatherCache.get(key);
  if (!entry || entry.expiresAt <= Date.now() || !entry.value) {
    return null;
  }

  return entry.value;
}

function writeCachedWeather(key: string, value: WeatherResult): void {
  weatherCache.set(key, {
    expiresAt: Date.now() + WEATHER_TTL_MS,
    promise: null,
    value,
  });
}

function choosePointByQuery(points: MetaPoint[], query: string): ResolvedPoint | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
  }

  const stationPoints = points.filter((point) => point.pointTypeId === "1" && hasCoordinates(point));
  const candidatePoints = stationPoints.length > 0 ? stationPoints : points.filter(hasCoordinates);
  if (candidatePoints.length === 0) {
    return null;
  }

  const scored = candidatePoints
    .map((point) => {
      const pointNameNorm = normalizeSearchText(point.pointName);
      const postal = (point.postalCode || "").trim();
      const isNumericQuery = /^\d{3,6}$/.test(normalizedQuery);

      let score = 0;
      if (pointNameNorm === normalizedQuery) score += 120;
      if (pointNameNorm.startsWith(normalizedQuery)) score += 90;
      if (pointNameNorm.includes(normalizedQuery)) score += 70;
      if (isNumericQuery && postal === normalizedQuery) score += 140;
      if (!isNumericQuery && postal && postal.startsWith(normalizedQuery)) score += 40;

      const cityPart = point.pointName.split("/")[0].trim();
      const cityPartNorm = normalizeSearchText(cityPart);
      if (cityPartNorm === normalizedQuery) score += 95;
      if (cityPartNorm.startsWith(normalizedQuery)) score += 75;

      return {
        point,
        score,
        nameLen: point.pointName.length,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.nameLen - b.nameLen);

  if (scored.length === 0) {
    // No station matched – try postal code centers and find the nearest station
    const postalPoints = points.filter((p) => p.pointTypeId === "2");
    const postalScored = postalPoints
      .map((point) => {
        const nameNorm = normalizeSearchText(point.pointName);
        const postal = (point.postalCode || "").trim();
        const isNumericQuery = /^\d{3,6}$/.test(normalizedQuery);
        let score = 0;
        if (nameNorm === normalizedQuery) score += 120;
        if (nameNorm.startsWith(normalizedQuery)) score += 90;
        if (nameNorm.includes(normalizedQuery)) score += 70;
        if (isNumericQuery && postal === normalizedQuery) score += 140;
        return { point, score };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);

    if (postalScored.length === 0) return null;

    const refPoint = postalScored[0].point;
    const refLat = refPoint.lat;
    const refLon = refPoint.lon;

    // Find nearest station by Euclidean distance on WGS84 degrees (good enough for CH)
    let nearest: MetaPoint | null = null;
    let minDist = Infinity;
    for (const station of candidatePoints) {
      const d = Math.hypot(station.lat - refLat, station.lon - refLon);
      if (d < minDist) {
        minDist = d;
        nearest = station;
      }
    }

    if (!nearest) return null;

    // Use the searched city name, not the station name
    const cityName = refPoint.pointName.split("/")[0].trim() || refPoint.pointName;
    return { pointId: nearest.pointId, cityName };
  }

  const winner = scored[0].point;
  const cityName = winner.pointName.split("/")[0].trim() || winner.pointName;
  return { pointId: winner.pointId, cityName };
}

function chooseNearestStationByCoordinates(points: MetaPoint[], location: WeatherLocation): ResolvedPoint | null {
  const stationPoints = points.filter((point) => point.pointTypeId === "1" && hasCoordinates(point));
  const candidatePoints = stationPoints.length > 0 ? stationPoints : points.filter(hasCoordinates);
  if (candidatePoints.length === 0) {
    return null;
  }

  let nearest: MetaPoint | null = null;
  let minDist = Infinity;

  for (const station of candidatePoints) {
    const d = Math.hypot(station.lat - location.latitude, station.lon - location.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = station;
    }
  }

  if (!nearest) {
    return null;
  }

  const cityName = nearest.pointName.split("/")[0].trim() || nearest.pointName;
  return { pointId: nearest.pointId, cityName };
}

async function resolvePointForQuery(query?: string, location?: WeatherLocation): Promise<ResolvedPoint> {
  const searchQuery = (query ?? "").trim();
  if (location) {
    try {
      const points = await loadMetaPoints();
      const resolved = chooseNearestStationByCoordinates(points, location);
      if (!resolved) {
        return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
      }

      return resolved;
    } catch {
      return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
    }
  }

  if (!searchQuery) {
    return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
  }

  const points = await loadMetaPoints();
  const resolved = choosePointByQuery(points, searchQuery);
  if (!resolved) {
    throw new Error(`Kein Ort zu "${searchQuery}" gefunden`);
  }

  return resolved;
}

export async function fetchWeatherAction(
  query?: string,
  language?: string,
  location?: WeatherLocation,
  options: WeatherFetchOptions = {}
): Promise<WeatherResult> {
  const locale = normalizeLanguage(language);
  const t = createTranslator(locale);
  const localeTag = getLocaleTag(locale);
  const includeHourly = options.includeHourly ?? true;
  let cityName = ZURICH_NAME;
  try {
    const resolvedPoint = await resolvePointForQuery(query, location);
    const pointId = resolvedPoint.pointId;
    cityName = resolvedPoint.cityName;
    const cacheKey = weatherCacheKey(pointId, locale, includeHourly);
    const cachedWeather = readCachedWeather(cacheKey);
    if (cachedWeather) {
      return cachedWeather;
    }

    const cachedDiskWeather = await readDiskCache<WeatherResult>("weather", cacheKey, WEATHER_TTL_MS);
    if (cachedDiskWeather) {
      writeCachedWeather(cacheKey, cachedDiskWeather);
      return cachedDiskWeather;
    }

    const cachedEntry = weatherCache.get(cacheKey);
    if (cachedEntry?.promise) {
      return cachedEntry.promise;
    }

    const fetchPromise = (async () => {
      // 1. Get the latest forecast item from the STAC API
      const stacData = await fetchJsonWithTimeout<{ features?: Array<{ assets?: Record<string, { href: string }> }> }>(STAC_ITEMS_URL, {
        cache: "no-store",
      });
      // Items are returned oldest-first; take the last (most recent) item
      const features = stacData.features ?? [];
      if (features.length === 0) {
        throw new Error("Keine Prognosedaten gefunden");
      }

      // 2. Find the newest item that has all required weather parameters.
      const selected = await selectLatestUsableAssets(features);
      if (!selected) {
        throw new Error("Wetterparameter nicht verfügbar");
      }

      // 3. Fetch CSVs in parallel (daily params are ≤1.2 MB each)
      const fetchPromises: Promise<string>[] = [
        fetchTextWithTimeout(selected.minUrl, { cache: "no-store" }),
        fetchTextWithTimeout(selected.maxUrl, { cache: "no-store" }),
        fetchTextWithTimeout(selected.iconUrl, { cache: "no-store" }),
      ];
      if (selected.precipUrl) {
        fetchPromises.push(fetchTextWithTimeout(selected.precipUrl, { cache: "no-store" }));
      }
      if (includeHourly) {
        if (selected.hourlyTempUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.hourlyTempUrl, { cache: "no-store" }));
        }
        if (selected.hourlyPrecipUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.hourlyPrecipUrl, { cache: "no-store" }));
        }
        if (selected.hourlySunshineUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.hourlySunshineUrl, { cache: "no-store" }));
        }
        if (selected.windSpeedUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.windSpeedUrl, { cache: "no-store" }));
        }
        if (selected.windGustUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.windGustUrl, { cache: "no-store" }));
        }
        if (selected.windDirectionUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.windDirectionUrl, { cache: "no-store" }));
        }
        if (selected.hourlyIconUrl) {
          fetchPromises.push(fetchTextWithTimeout(selected.hourlyIconUrl, { cache: "no-store" }));
        }
      }
      const results = await Promise.all(fetchPromises);
      const [
        minText,
        maxText,
        iconText,
        precipText,
        hourlyTempText,
        hourlyPrecipText,
        hourlySunshineText,
        windSpeedText,
        windGustText,
        windDirectionText,
        hourlyIconText,
      ] = results;

      // 4. Parse CSVs for selected place
      const minMap = parseCsvMap(minText, pointId);
      const maxMap = parseCsvMap(maxText, pointId);
      const iconMap =
        selected.iconParam === "jp2000d0"
          ? parseCsvMap(iconText, pointId)
          : parseHourlyIconCsvToDailyMap(iconText, pointId);
      const precipMap = precipText
        ? parseCsvMap(precipText, pointId)
        : new Map<string, number>();
      const hourlyTempMap = includeHourly && hourlyTempText
        ? parseCsvMap(hourlyTempText, pointId)
        : new Map<string, number>();
      const hourlyPrecipMap = includeHourly && hourlyPrecipText
        ? parseCsvMap(hourlyPrecipText, pointId)
        : new Map<string, number>();
      const hourlySunshineMap = includeHourly && hourlySunshineText
        ? parseCsvMap(hourlySunshineText, pointId)
        : new Map<string, number>();
      const windSpeedMap = includeHourly && windSpeedText
        ? parseCsvMap(windSpeedText, pointId)
        : new Map<string, number>();
      const windGustMap = includeHourly && windGustText
        ? parseCsvMap(windGustText, pointId)
        : new Map<string, number>();
      const windDirectionMap = includeHourly && windDirectionText
        ? parseCsvMap(windDirectionText, pointId)
        : new Map<string, number>();
      const hourlyIconMap = includeHourly && hourlyIconText
        ? parseCsvMap(hourlyIconText, pointId)
        : new Map<string, number>();

      // 5. Build 5-day forecast
      const dates = [...minMap.keys()].sort().slice(0, 5);
      if (dates.length === 0) {
        throw new Error(`Keine Prognosewerte für ${cityName} gefunden`);
      }

      const days: DayForecast[] = dates.map((dateKey) => {
        const iconCode = Math.round(iconMap.get(dateKey) ?? 0);
        const iconInfo = iconForCode(iconCode, t);
        const hourly = includeHourly
          ? buildHourlySeries(
              dateKey.slice(0, 8),
              localeTag,
              t,
              hourlyTempMap,
              hourlyPrecipMap,
              hourlySunshineMap,
              windSpeedMap,
              windGustMap,
              windDirectionMap,
              hourlyIconMap
            )
          : undefined;
        return {
          date: `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`,
          dayLabel: formatDayLabel(dateKey, localeTag),
          tempMin: Math.round(minMap.get(dateKey) ?? 0),
          tempMax: Math.round(maxMap.get(dateKey) ?? 0),
          precipMm:
            Math.round((precipMap.get(dateKey) ?? 0) * 10) / 10,
          emoji: iconInfo.emoji,
          label: iconInfo.label,
          hourly,
        };
      });

      return { city: cityName, days };
    })();

    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_TTL_MS,
      promise: fetchPromise,
      value: null,
    });

    try {
      const result = await fetchPromise;
      writeCachedWeather(cacheKey, result);
      void writeDiskCache("weather", cacheKey, result);
      return result;
    } catch (error) {
      weatherCache.delete(cacheKey);
      throw error;
    }
  } catch {
    const message = t("weather.error");
    return { city: cityName, days: [], error: message };
  }
}

export async function searchLocationsAction(query: string, language?: string): Promise<string[]> {
  const locale = normalizeLanguage(language);
  const q = query.trim();
  if (q.length < 2) return [];

  let points: MetaPoint[];
  try {
    points = await loadMetaPoints();
  } catch {
    return [];
  }

  const normalizedQuery = normalizeSearchText(q);
  const isNumeric = /^\d{3,6}$/.test(normalizedQuery);

  const seen = new Set<string>();
  const results: Array<{ label: string; score: number }> = [];

  for (const point of points) {
    const nameNorm = normalizeSearchText(point.pointName);
    const postal = (point.postalCode || "").trim();
    const cityPart = point.pointName.split("/")[0].trim();
    const cityNorm = normalizeSearchText(cityPart);

    let score = 0;
    if (isNumeric) {
      if (postal === normalizedQuery) score += 140;
    } else {
      if (cityNorm === normalizedQuery) score += 120;
      else if (cityNorm.startsWith(normalizedQuery)) score += 90;
      else if (cityNorm.includes(normalizedQuery)) score += 60;
      else if (nameNorm.startsWith(normalizedQuery)) score += 70;
      else if (nameNorm.includes(normalizedQuery)) score += 40;
    }

    if (score === 0) continue;

    // Label: for PLZ centers show "City (PLZ)", for stations just "City"
    const label = isNumeric && postal
      ? `${cityPart} (${postal})`
      : cityPart;

    if (seen.has(label)) continue;
    seen.add(label);
    results.push({ label, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, getLocaleTag(locale)))
    .slice(0, 8)
    .map((r) => r.label);
}
