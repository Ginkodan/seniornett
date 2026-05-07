// SBB Train timetable integration using transport.opendata.ch API
// This API provides real-time train connection data for Switzerland

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

const SWISS_TIME_ZONE = "Europe/Zurich";
const MAX_CONNECTION_PAGE = 3;
const INITIAL_RESULTS_PAGE = 1;

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
    const date = new Date(isoTime);
    return date.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: SWISS_TIME_ZONE,
    });
  } catch {
    return isoTime;
  }
}

function getSwissDateKey(isoTime: string): string | null {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: SWISS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseTimeMinutes(value: string): number | null {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function getSwissClockMinutes(isoTime: string): number | null {
  const date = new Date(isoTime);
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

  try {
    const apiIsArrivalTime = isArrival ? "1" : "0";

    // Use station names/IDs as-is (they can be either station IDs or names)
    // The API accepts both formats
    const params = new URLSearchParams({
      from: fromStation.trim(),
      to: toStation.trim(),
      date: date,
      time: time,
      isArrivalTime: apiIsArrivalTime,
      limit: String(requestedLimit),
      page: String(requestedPage),
    });

    const url = `https://transport.opendata.ch/v1/connections?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        connections: [],
        from: fromStation,
        to: toStation,
        ...pageFlags,
        error: `Failed to fetch connections: ${response.statusText}`,
      };
    }

    const data = await response.json() as ApiConnectionsResponse;

    const connections: Connection[] = (data.connections || []).map((c) => {
      const departure = c.from.departure;
      const arrival = c.to.arrival;

      const durationMs = new Date(arrival).getTime() - new Date(departure).getTime();
      const durationStr = parseDuration(
        `PT${Math.floor(durationMs / 3600000)}H${Math.floor((durationMs % 3600000) / 60000)}M`
      );

      // The API provides transfers count directly
      // Also, use 'sections' instead of 'legs' - that's the correct API field name
      const sectionsArray = Array.isArray(c.sections) ? c.sections : [];
      const numChanges = c.transfers ?? (sectionsArray.length > 1 ? sectionsArray.length - 1 : 0);

      function normalizeTrainNumber(value?: string): string {
        if (!value) return "–";
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? value : String(parsed);
      }

      return {
        from: c.from.station.name,
        to: c.to.station.name,
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
      };
    });

    const filteredConnections = connections.filter((connection) => {
      const departureDate = getSwissDateKey(connection.departureIso);
      const arrivalDate = getSwissDateKey(connection.arrivalIso);
      const departureTime = new Date(connection.departureIso).getTime();
      const arrivalTime = new Date(connection.arrivalIso).getTime();

      if (departureDate === null || arrivalDate === null || Number.isNaN(departureTime) || Number.isNaN(arrivalTime)) {
        return true;
      }

      if (departureDate !== date) {
        return false;
      }

      if (!applyInitialTimeFilter || requestedMinutes === null) {
        return true;
      }

      const relevantMinutes = isArrival
        ? getSwissClockMinutes(connection.arrivalIso)
        : getSwissClockMinutes(connection.departureIso);

      if (relevantMinutes === null) {
        return true;
      }

      return isArrival
        ? relevantMinutes <= requestedMinutes
        : relevantMinutes >= requestedMinutes;
    });

    filteredConnections.sort((a, b) => {
      const aTime = new Date(isArrival ? a.arrivalIso : a.departureIso).getTime();
      const bTime = new Date(isArrival ? b.arrivalIso : b.departureIso).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return isArrival ? bTime - aTime : aTime - bTime;
    });

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
