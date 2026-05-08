// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Bus, Clock3, Rabbit, Ship, Snail, Train, TramFront } from "lucide-react";

export const EMPTY_ARRAY = [];
export const SWISS_TIME_ZONE = "Europe/Zurich";

const TRANSFER_STATUS_META = {
  tight: {
    icon: Rabbit,
    labelKey: "sbb.transfer.status.tight",
    tone: "tight",
  },
  okay: {
    icon: Clock3,
    labelKey: "sbb.transfer.status.okay",
    tone: "okay",
  },
  plenty: {
    icon: Snail,
    labelKey: "sbb.transfer.status.plenty",
    tone: "plenty",
  },
  unknown: {
    icon: Clock3,
    labelKey: "sbb.transfer.status.unknown",
    tone: "unknown",
  },
};

export function getSwissNowDefaults() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SWISS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}:${lookup.minute}`,
  };
}

export function getTransportIcon(category, number) {
  const type = `${category || ""} ${number || ""}`.trim().toLowerCase();
  const primaryToken = type.split(/\s+/)[0] || "";

  if (primaryToken === "b" || primaryToken === "bus" || type.startsWith("bus") || type.includes("postauto")) {
    return Bus;
  }

  if (
    primaryToken === "t" ||
    primaryToken === "tram" ||
    primaryToken === "m" ||
    type.startsWith("tram") ||
    type.includes("metro")
  ) {
    return TramFront;
  }

  if (type.includes("ship") || type.includes("ferry") || type.includes("bat") || type.includes("boat")) {
    return Ship;
  }

  return Train;
}

export function getPlatformLabel(platform, category, number) {
  if (!platform) return null;
  const normalizedPlatform = String(platform).trim();
  if (!normalizedPlatform) return null;
  const barePlatform = normalizedPlatform.replace(/^(gleis|platform|kante|quai|stand|steg|pier)\s*/i, "").trim();

  if (!barePlatform) return null;

  if (/^[0-9]+[a-z]?$/i.test(barePlatform)) {
    return `Gleis ${barePlatform}`;
  }

  if (/^[a-z]$/i.test(barePlatform)) {
    return `Kante ${barePlatform.toUpperCase()}`;
  }

  if (/^(gleis|platform)\b/i.test(normalizedPlatform)) {
    return `Gleis ${barePlatform}`;
  }

  if (/^(kante|quai|stand)\b/i.test(normalizedPlatform)) {
    return `Kante ${barePlatform}`;
  }

  if (/^(steg|pier)\b/i.test(normalizedPlatform)) {
    return `Steg ${barePlatform}`;
  }

  const icon = getTransportIcon(category, number);
  if (icon === Ship) return `Steg ${barePlatform}`;
  if ((icon === Bus || icon === TramFront) && /^[a-z][a-z0-9-]*$/i.test(barePlatform)) {
    return `Kante ${barePlatform.toUpperCase()}`;
  }

  return `Gleis ${barePlatform}`;
}

export function isVehicleLeg(leg) {
  return Boolean(leg && (leg.category?.trim() || (leg.number && leg.number !== "–")));
}

export function getDisplayLegs(legs) {
  return (legs || []).filter(isVehicleLeg);
}

export function getLegRealtimeStatus(leg, t) {
  if (!leg) return null;

  if (leg.cancelled) {
    return {
      tone: "cancelled",
      text: t("sbb.realtime.cancelled"),
    };
  }

  const departureDelay = typeof leg.departureDelay === "number" ? leg.departureDelay : null;
  const arrivalDelay = typeof leg.arrivalDelay === "number" ? leg.arrivalDelay : null;
  const maxDelay = Math.max(departureDelay ?? 0, arrivalDelay ?? 0);

  if (maxDelay > 0) {
    return {
      tone: "delayed",
      text: t("sbb.realtime.delayedMinutes", { minutes: maxDelay }),
    };
  }

  return null;
}

export function getConnectionRealtimeState(connection, t) {
  const displayLegs = getDisplayLegs(connection?.legs);

  if (displayLegs.some((leg) => leg.cancelled)) {
    return {
      tone: "cancelled",
      label: t("sbb.realtime.cancelled"),
    };
  }

  if (displayLegs.some((leg) => (leg.departureDelay ?? 0) > 0 || (leg.arrivalDelay ?? 0) > 0)) {
    return {
      tone: "delayed",
      label: t("sbb.realtime.delayed"),
    };
  }

  return null;
}

export function getTransferStatusMeta(assessment, t) {
  if (!assessment) return null;
  const status = TRANSFER_STATUS_META[assessment.tone] || TRANSFER_STATUS_META.unknown;
  return {
    icon: status.icon,
    label: t(status.labelKey),
    tone: status.tone,
  };
}

export function parseClockMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function buildTransferMarkers(connection) {
  const displayLegs = getDisplayLegs(connection.legs);
  const departureMinutes = parseClockMinutes(connection.departure);
  const arrivalMinutes = parseClockMinutes(connection.arrival);
  if (departureMinutes === null || arrivalMinutes === null) return [];

  const totalMinutes = arrivalMinutes >= departureMinutes
    ? arrivalMinutes - departureMinutes
    : arrivalMinutes + 24 * 60 - departureMinutes;

  if (totalMinutes <= 0) return [];

  return displayLegs
    .slice(0, -1)
    .map((leg, idx) => {
      const currentArrival = parseClockMinutes(leg.arrivalTime);
      const nextDeparture = parseClockMinutes(displayLegs[idx + 1]?.departureTime);
      if (currentArrival === null || nextDeparture === null) return null;

      const normalizedArrival = currentArrival < departureMinutes ? currentArrival + 24 * 60 : currentArrival;
      const normalizedNextDeparture = nextDeparture < normalizedArrival ? nextDeparture + 24 * 60 : nextDeparture;
      const markerMinutes = normalizedArrival + ((normalizedNextDeparture - normalizedArrival) / 2);
      const position = ((markerMinutes - departureMinutes) / totalMinutes) * 100;

      if (!Number.isFinite(position)) return null;

      return {
        key: `${idx}-${leg.arrivalStation}-${leg.arrivalTime}`,
        station: leg.arrivalStation,
        arrival: leg.arrivalTime,
        departure: displayLegs[idx + 1]?.departureTime,
        position: Math.min(100, Math.max(0, position)),
      };
    })
    .filter(Boolean);
}

export function getTransferDetails(connection, displayLegs, idx) {
  const currentLeg = displayLegs[idx];
  const nextLeg = displayLegs[idx + 1];
  if (!currentLeg || !nextLeg) return null;

  const allLegs = Array.isArray(connection?.legs) ? connection.legs : EMPTY_ARRAY;
  const currentIndex = allLegs.indexOf(currentLeg);
  const nextIndex = allLegs.indexOf(nextLeg);
  const betweenLegs = currentIndex >= 0 && nextIndex > currentIndex
    ? allLegs.slice(currentIndex + 1, nextIndex)
    : EMPTY_ARRAY;
  const walkLegs = betweenLegs.filter((leg) => !isVehicleLeg(leg));

  const fromStation = walkLegs[0]?.departureStation || currentLeg.arrivalStation;
  const toStation = walkLegs[walkLegs.length - 1]?.arrivalStation || nextLeg.departureStation;
  const fromPlatform = getPlatformLabel(currentLeg.arrivalPlatform, currentLeg.category, currentLeg.number);
  const toPlatform = getPlatformLabel(nextLeg.departurePlatform, nextLeg.category, nextLeg.number);

  if (walkLegs.length > 0 && fromStation && toStation && fromStation !== toStation) {
    return {
      station: fromStation,
      text: toPlatform ? `Umsteigen zu Fuss nach ${toStation}, ab ${toPlatform}` : `Umsteigen zu Fuss nach ${toStation}`,
    };
  }

  if (fromPlatform && toPlatform) {
    return {
      station: currentLeg.arrivalStation,
      text: `Umsteigen von ${fromPlatform} nach ${toPlatform}`,
    };
  }

  if (toPlatform) {
    return {
      station: currentLeg.arrivalStation,
      text: `Umsteigen weiter ab ${toPlatform}`,
    };
  }

  if (currentLeg.arrivalStation !== nextLeg.departureStation) {
    return {
      station: currentLeg.arrivalStation,
      text: `Umsteigen nach ${nextLeg.departureStation}`,
    };
  }

  return {
    station: currentLeg.arrivalStation,
    text: "Umsteigen",
  };
}

export function formatTransferMinutes(minutes) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) {
    return "–";
  }

  return `${minutes} min`;
}

export function formatWalkDistanceMeters(meters) {
  if (typeof meters !== "number" || Number.isNaN(meters) || meters <= 0) {
    return null;
  }

  if (meters >= 1000) {
    return `ca. ${(meters / 1000).toFixed(meters >= 5000 ? 0 : 1)} km`;
  }

  return `ca. ${Math.round(meters)} m`;
}
