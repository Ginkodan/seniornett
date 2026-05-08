"use server";

import { createTranslator, getLocaleTag, normalizeLanguage } from "@/lib/i18n";

// MeteoSwiss OGD Local Forecast data
// See: https://opendatadocs.meteoswiss.ch/e4-local-forecast-model-data/e4-local-forecast-model-data

const STAC_ITEMS_URL =
  "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items?limit=10";
const META_POINTS_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_point.csv";

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

function choosePointByQuery(points: MetaPoint[], query: string): ResolvedPoint | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
  }

  const stationPoints = points.filter((point) => point.pointTypeId === "1");
  if (stationPoints.length === 0) {
    return null;
  }

  const scored = stationPoints
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
    for (const station of stationPoints) {
      if (!station.lat && !station.lon) continue;
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
  const stationPoints = points.filter((point) => point.pointTypeId === "1");
  if (stationPoints.length === 0) {
    return null;
  }

  let nearest: MetaPoint | null = null;
  let minDist = Infinity;

  for (const station of stationPoints) {
    if (!station.lat && !station.lon) continue;
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
    const metaResp = await fetch(META_POINTS_URL, {
      next: { revalidate: 86400 },
    });
    if (!metaResp.ok) {
      throw new Error("Ortsliste konnte nicht geladen werden");
    }

    const metaBuffer = await metaResp.arrayBuffer();
    const metaText = new TextDecoder("iso-8859-1").decode(metaBuffer);
    const points = parseMetaPoints(metaText);
    const resolved = chooseNearestStationByCoordinates(points, location);
    if (!resolved) {
      throw new Error("Kein Ort zur aktuellen Position gefunden");
    }

    return resolved;
  }

  if (!searchQuery) {
    return { pointId: ZURICH_POINT_ID, cityName: ZURICH_NAME };
  }

  const metaResp = await fetch(META_POINTS_URL, {
    next: { revalidate: 86400 },
  });
  if (!metaResp.ok) {
    throw new Error("Ortsliste konnte nicht geladen werden");
  }

  const metaBuffer = await metaResp.arrayBuffer();
  const metaText = new TextDecoder("iso-8859-1").decode(metaBuffer);
  const points = parseMetaPoints(metaText);
  const resolved = choosePointByQuery(points, searchQuery);
  if (!resolved) {
    throw new Error(`Kein Ort zu "${searchQuery}" gefunden`);
  }

  return resolved;
}

export async function fetchWeatherAction(
  query?: string,
  language?: string,
  location?: WeatherLocation
): Promise<WeatherResult> {
  const locale = normalizeLanguage(language);
  const t = createTranslator(locale);
  const localeTag = getLocaleTag(locale);
  let cityName = ZURICH_NAME;
  try {
    const resolvedPoint = await resolvePointForQuery(query, location);
    const pointId = resolvedPoint.pointId;
    cityName = resolvedPoint.cityName;

    // 1. Get the latest forecast item from the STAC API
    const stacResp = await fetch(STAC_ITEMS_URL, {
      next: { revalidate: 1800 },
    });
    if (!stacResp.ok) throw new Error("STAC API nicht erreichbar");
    const stacData = await stacResp.json();
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
      fetch(selected.minUrl).then((r) => r.text()),
      fetch(selected.maxUrl).then((r) => r.text()),
      fetch(selected.iconUrl).then((r) => r.text()),
    ];
    if (selected.precipUrl) {
      fetchPromises.push(fetch(selected.precipUrl).then((r) => r.text()));
    }
    if (selected.hourlyTempUrl) {
      fetchPromises.push(fetch(selected.hourlyTempUrl).then((r) => r.text()));
    }
    if (selected.hourlyPrecipUrl) {
      fetchPromises.push(fetch(selected.hourlyPrecipUrl).then((r) => r.text()));
    }
    if (selected.hourlySunshineUrl) {
      fetchPromises.push(fetch(selected.hourlySunshineUrl).then((r) => r.text()));
    }
    if (selected.windSpeedUrl) {
      fetchPromises.push(fetch(selected.windSpeedUrl).then((r) => r.text()));
    }
    if (selected.windGustUrl) {
      fetchPromises.push(fetch(selected.windGustUrl).then((r) => r.text()));
    }
    if (selected.windDirectionUrl) {
      fetchPromises.push(fetch(selected.windDirectionUrl).then((r) => r.text()));
    }
    if (selected.hourlyIconUrl) {
      fetchPromises.push(fetch(selected.hourlyIconUrl).then((r) => r.text()));
    }
    const results = await Promise.all(fetchPromises);
    const [minText, maxText, iconText, precipText, hourlyTempText, hourlyPrecipText, hourlySunshineText, windSpeedText, windGustText, windDirectionText, hourlyIconText] = results;

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
    const hourlyTempMap = hourlyTempText
      ? parseCsvMap(hourlyTempText, pointId)
      : new Map<string, number>();
    const hourlyPrecipMap = hourlyPrecipText
      ? parseCsvMap(hourlyPrecipText, pointId)
      : new Map<string, number>();
    const hourlySunshineMap = hourlySunshineText
      ? parseCsvMap(hourlySunshineText, pointId)
      : new Map<string, number>();
    const windSpeedMap = windSpeedText
      ? parseCsvMap(windSpeedText, pointId)
      : new Map<string, number>();
    const windGustMap = windGustText
      ? parseCsvMap(windGustText, pointId)
      : new Map<string, number>();
    const windDirectionMap = windDirectionText
      ? parseCsvMap(windDirectionText, pointId)
      : new Map<string, number>();
    const hourlyIconMap = hourlyIconText
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
      const hourly = buildHourlySeries(
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
      );
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
  } catch {
    const message = t("weather.error");
    return { city: cityName, days: [], error: message };
  }
}

export async function searchLocationsAction(query: string, language?: string): Promise<string[]> {
  const locale = normalizeLanguage(language);
  const q = query.trim();
  if (q.length < 2) return [];

  const metaResp = await fetch(META_POINTS_URL, { next: { revalidate: 86400 } });
  if (!metaResp.ok) return [];

  const metaBuffer = await metaResp.arrayBuffer();
  const metaText = new TextDecoder("iso-8859-1").decode(metaBuffer);
  const points = parseMetaPoints(metaText);

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
