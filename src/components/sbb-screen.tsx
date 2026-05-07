// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { MapPin, Train, Bus, Ship, TramFront, AlertCircle, Loader2, X, Navigation, Clock3, Rabbit, Snail, Footprints } from "lucide-react";
import { searchStationsAction, searchConnectionsAction } from "@/app/actions/sbb";
import { useAppState } from "./app-provider";
import { Button, SeniorNetPage } from "./ui";
import styles from "./sbb-screen.module.css";

const EMPTY_ARRAY = [];
const INITIAL_RESULTS_PAGE = 1;
const SWISS_TIME_ZONE = "Europe/Zurich";
const EDGE_FETCH_LIMIT = 16;
const EDGE_WINDOWS_MINUTES = [20, 40, 60, 90, 180];
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

function getSwissNowDefaults() {
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

function getTransportIcon(category, number) {
  const type = `${category || ""} ${number || ""}`.trim().toLowerCase();
  const primaryToken = type.split(/\s+/)[0] || "";

  if (
    primaryToken === "b" ||
    primaryToken === "bus" ||
    type.startsWith("bus") ||
    type.includes("postauto")
  ) {
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

  if (
    type.includes("ship") ||
    type.includes("ferry") ||
    type.includes("bat") ||
    type.includes("boat")
  ) {
    return Ship;
  }

  return Train;
}

function getPlatformLabel(platform, category, number) {
  if (!platform) return null;
  const normalizedPlatform = String(platform).trim();
  if (!normalizedPlatform) return null;
  const barePlatform = normalizedPlatform
    .replace(/^(gleis|platform|kante|quai|stand|steg|pier)\s*/i, "")
    .trim();

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

  const TransportIcon = getTransportIcon(category, number);
  if (TransportIcon === Ship) return `Steg ${barePlatform}`;
  if (TransportIcon === Bus || TransportIcon === TramFront) {
    if (/^[a-z][a-z0-9-]*$/i.test(barePlatform)) {
      return `Kante ${barePlatform.toUpperCase()}`;
    }
  }
  return `Gleis ${barePlatform}`;
}

function isVehicleLeg(leg) {
  return Boolean(
    leg &&
    (leg.category?.trim() || (leg.number && leg.number !== "–"))
  );
}

function getDisplayLegs(legs) {
  return (legs || []).filter(isVehicleLeg);
}

function getLegRealtimeStatus(leg, t) {
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

function getConnectionRealtimeState(connection, t) {
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

function getTransferStatusMeta(assessment, t) {
  if (!assessment) return null;
  const status = TRANSFER_STATUS_META[assessment.tone] || TRANSFER_STATUS_META.unknown;
  return {
    icon: status.icon,
    label: t(status.labelKey),
    tone: status.tone,
  };
}

function parseClockMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function buildTransferMarkers(connection) {
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

      const normalizedArrival = currentArrival < departureMinutes
        ? currentArrival + 24 * 60
        : currentArrival;
      const normalizedNextDeparture = nextDeparture < normalizedArrival
        ? nextDeparture + 24 * 60
        : nextDeparture;
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

function getTransferDetails(connection, displayLegs, idx) {
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
    if (toPlatform) {
      return {
        station: fromStation,
        text: `Umsteigen zu Fuss nach ${toStation}, ab ${toPlatform}`,
      };
    }

    return {
      station: fromStation,
      text: `Umsteigen zu Fuss nach ${toStation}`,
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

function formatTransferMinutes(minutes) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) {
    return "–";
  }

  return `${minutes} min`;
}

function formatWalkDistanceMeters(meters) {
  if (typeof meters !== "number" || Number.isNaN(meters) || meters <= 0) {
    return null;
  }

  if (meters >= 1000) {
    return `ca. ${(meters / 1000).toFixed(meters >= 5000 ? 0 : 1)} km`;
  }

  return `ca. ${Math.round(meters)} m`;
}

function StationAutocomplete({ label, value, onChange, onSelect, suggestions, error }) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  return (
    <div className="sbb-autocomplete" ref={wrapRef}>
      <label className="sbb-label">{label}</label>
      <input
        type="text"
        className="sbb-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder="z. B. Bern oder Zürich"
        aria-label={label}
      />
      {error && <div className="sbb-error">{error}</div>}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="sbb-suggestions">
          {suggestions.map((s, idx) => (
            <li key={idx} className="sbb-suggestion-item">
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setShowSuggestions(false);
                }}
                className="sbb-suggestion-button"
              >
                <MapPin size={20} />
                <span>{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConnectionDetail({ connection, onClose }) {
  const { t } = useAppState();
  const transferMarkers = React.useMemo(() => buildTransferMarkers(connection), [connection]);
  const displayLegs = React.useMemo(() => getDisplayLegs(connection.legs), [connection.legs]);
  const accessAssessment = connection.accessAssessment;
  const destinationAssessment = connection.destinationAssessment;
  const firstVehicleLeg = displayLegs[0];
  const lastVehicleLeg = displayLegs[displayLegs.length - 1];
  const accessDistanceLabel = formatWalkDistanceMeters(accessAssessment?.walkDistanceMeters);
  const destinationDistanceLabel = formatWalkDistanceMeters(destinationAssessment?.walkDistanceMeters);
  const accessSummary = accessAssessment && firstVehicleLeg
    ? t("sbb.access.summary", {
      from: connection.from,
      to: firstVehicleLeg.departureStation,
    })
    : "";
  const destinationSummary = destinationAssessment && lastVehicleLeg
    ? t("sbb.access.summaryEnd", {
      from: lastVehicleLeg.arrivalStation,
      to: connection.to,
    })
    : "";
  const accessTitle = accessAssessment && firstVehicleLeg
    ? t("sbb.access.walk")
    : "";
  const destinationTitle = destinationAssessment && lastVehicleLeg
    ? t("sbb.access.walk")
    : "";

  return (
    <div className="sbb-connection-detail">
      <div className="sbb-detail-header">
        <div>
          <h3>{connection.from} → {connection.to}</h3>
          <p className="sbb-detail-date">{connection.duration}</p>
        </div>
        <button type="button" className="sbb-detail-close" onClick={onClose} aria-label="Schliessen">
          <X size={24} />
        </button>
      </div>

      <div className="sbb-detail-timeline">
        <div className="sbb-timeline-bar"></div>
        <div className="sbb-timeline-label sbb-timeline-start">{connection.departure}</div>
        <div className="sbb-timeline-label sbb-timeline-end">{connection.arrival}</div>
        {transferMarkers.map((marker) => (
          <div
            key={marker.key}
            className="sbb-timeline-marker"
            style={{ left: `${marker.position}%` }}
            title={`${marker.station} ${marker.arrival} - ${marker.departure}`}
            aria-hidden="true"
          >
            <span className="sbb-timeline-dot" />
          </div>
        ))}
      </div>

      <div className="sbb-detail-content">
        <div className="sbb-journey-point sbb-journey-start">
          <div className="sbb-point-name">{connection.from}</div>
        </div>

        {accessAssessment && firstVehicleLeg && (
          <div className="sbb-walk-strip">
            <div className="sbb-walk-box">
              <div className="sbb-access-title">{accessTitle}</div>
              <div className="sbb-access-summary-text">{accessSummary}</div>
              <div className="sbb-access-meta">
                <span className="sbb-access-pill">
                  <Footprints size={14} />
                  <span>{t("sbb.access.walk")}</span>
                </span>
                <span className="sbb-transfer-minutes">
                  {formatTransferMinutes(accessAssessment.givenMinutes)}
                </span>
                {accessDistanceLabel && (
                  <span className="sbb-transfer-distance">
                    {accessDistanceLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {displayLegs.length > 0 && (
          <div className="sbb-journey-sections">
            {displayLegs.map((leg, idx) => {
              const TransportIcon = getTransportIcon(leg.category, leg.number);
              const platformLabel = getPlatformLabel(leg.departurePlatform, leg.category, leg.number);
              const realtimeStatus = getLegRealtimeStatus(leg, t);
              return (
                <React.Fragment key={idx}>
                  <div className="sbb-section">
                    <div className="sbb-section-header">
                      <div className="sbb-section-title">
                        <div className="sbb-time">{leg.departureTime}</div>
                        <div className="sbb-train-badge">
                          <TransportIcon size={16} />
                          <span>{leg.category} {leg.number}</span>
                        </div>
                        {leg.direction && (
                          <span className="sbb-leg-direction">Richtung {leg.direction}</span>
                        )}
                      </div>
                      <div className="sbb-platform">{platformLabel || "–"}</div>
                    </div>

                    {realtimeStatus && (
                      <div className={`sbb-leg-status sbb-leg-status-${realtimeStatus.tone}`} role="status">
                        {realtimeStatus.text}
                      </div>
                    )}

                    <div className="sbb-leg-body">
                      <div className="sbb-leg-row">
                        <span>{leg.departureStation}</span>
                        <span>ab {leg.departureTime}</span>
                      </div>
                      <div className="sbb-leg-row">
                        <span>{leg.arrivalStation}</span>
                        <span>an {leg.arrivalTime}</span>
                      </div>
                    </div>
                  </div>

                  {idx < displayLegs.length - 1 && (
                    (() => {
                      const transfer = getTransferDetails(connection, displayLegs, idx);
                      const transferAssessment = connection.transferAssessments?.[idx];
                      const transferStatus = getTransferStatusMeta(transferAssessment, t);
                      if (!transfer) return null;
                      const TransferStatusIcon = transferStatus?.icon;

                      return (
                        <div className={`sbb-transfer ${transferAssessment ? `sbb-transfer-${transferAssessment.tone}` : ""}`}>
                          <div className="sbb-transfer-line">
                            <span className="sbb-transfer-station">{transfer.station}</span>
                            <span className="sbb-transfer-label">{transfer.text}</span>
                          </div>
                          {transferAssessment && transferStatus && (
                            <div className="sbb-transfer-meta">
                              {typeof transferAssessment.walkMinutes === "number" && transferAssessment.walkMinutes > 0 && (
                                <span className="sbb-transfer-walk" title={t("sbb.transfer.walk")}>
                                  <Footprints size={14} />
                                  <span>{t("sbb.transfer.walk")}</span>
                                </span>
                              )}
                              <span
                                className={`sbb-transfer-badge sbb-transfer-badge-${transferStatus.tone}`}
                                aria-label={transferStatus.label}
                                title={transferStatus.label}
                              >
                                <TransferStatusIcon size={14} />
                                <span>{transferStatus.label}</span>
                              </span>
                              <span className="sbb-transfer-minutes">
                                {t("sbb.transfer.minutes", {
                                  required: formatTransferMinutes(transferAssessment.requiredMinutes),
                                  given: formatTransferMinutes(transferAssessment.givenMinutes),
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {destinationAssessment && lastVehicleLeg && (
          <div className="sbb-walk-strip">
            <div className="sbb-walk-box">
              <div className="sbb-access-title">{destinationTitle}</div>
              <div className="sbb-access-summary-text">{destinationSummary}</div>
              <div className="sbb-access-meta">
                <span className="sbb-access-pill">
                  <Footprints size={14} />
                  <span>{t("sbb.access.walk")}</span>
                </span>
                <span className="sbb-transfer-minutes">
                  {formatTransferMinutes(destinationAssessment.givenMinutes)}
                </span>
                {destinationDistanceLabel && (
                  <span className="sbb-transfer-distance">
                    {destinationDistanceLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="sbb-journey-point sbb-journey-end">
          <div className="sbb-point-name">{connection.to}</div>
        </div>
      </div>
    </div>
  );
}

function ConnectionCard({ connection, onSelect }) {
  const { t } = useAppState();
  const realtimeState = getConnectionRealtimeState(connection, t);

  return (
    <button
      type="button"
      className="sbb-connection-card"
      onClick={() => onSelect(connection)}
      aria-label={`${connection.from} nach ${connection.to}, Abfahrt ${connection.departure}, Ankunft ${connection.arrival}`}
    >
      <div className="sbb-card-left">
        <div className="sbb-time-from">{connection.departure}</div>
        <div className="sbb-station-from">{connection.from}</div>
      </div>

      <div className="sbb-card-middle">
        <div className="sbb-card-duration-row">
          <div className="sbb-duration">{connection.duration}</div>
          {realtimeState && (
            <span
              className={`sbb-card-status-icon sbb-card-status-icon-${realtimeState.tone}`}
              aria-label={realtimeState.label}
              title={realtimeState.label}
            >
              <AlertCircle size={18} />
            </span>
          )}
        </div>
        {connection.changes > 0 && (
          <div className="sbb-changes">{connection.changes} Umstieg{connection.changes > 1 ? "e" : ""}</div>
        )}
        {connection.changes === 0 && <div className="sbb-changes">Direkt</div>}
      </div>

      <div className="sbb-card-right">
        <div className="sbb-time-to">{connection.arrival}</div>
        <div className="sbb-station-to">{connection.to}</div>
      </div>
    </button>
  );
}

function getConnectionKey(connection) {
  return `${connection.departureIso}|${connection.arrivalIso}|${connection.from}|${connection.to}|${connection.duration}`;
}

function formatSwissDateTimeParts(isoTime) {
  const trimmed = `${isoTime || ""}`.trim();
  const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (localMatch && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) {
    return {
      date: `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}`,
      time: `${localMatch[4]}:${localMatch[5]}`,
    };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
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

function shiftSwissDateTimeParts(date, time, offsetMinutes) {
  const base = new Date(Date.UTC(
    Number.parseInt(date.slice(0, 4), 10),
    Number.parseInt(date.slice(5, 7), 10) - 1,
    Number.parseInt(date.slice(8, 10), 10),
    Number.parseInt(time.slice(0, 2), 10),
    Number.parseInt(time.slice(3, 5), 10),
    0
  ));
  if (Number.isNaN(base.getTime())) return null;

  base.setUTCMinutes(base.getUTCMinutes() + offsetMinutes);
  const shifted = base.toISOString();
  return {
    date: shifted.slice(0, 10),
    time: shifted.slice(11, 16),
  };
}

export function SbbScreen() {
  const { t } = useAppState();
  const defaultSwissDateTime = React.useMemo(() => getSwissNowDefaults(), []);

  const [fromStation, setFromStation] = React.useState("");
  const [fromStationId, setFromStationId] = React.useState("");
  const [toStation, setToStation] = React.useState("");
  const [toStationId, setToStationId] = React.useState("");
  const [date, setDate] = React.useState(defaultSwissDateTime.date);
  const [time, setTime] = React.useState(defaultSwissDateTime.time);
  const [isArrival, setIsArrival] = React.useState(false);

  const [fromSuggestions, setFromSuggestions] = React.useState(EMPTY_ARRAY);
  const [toSuggestions, setToSuggestions] = React.useState(EMPTY_ARRAY);
  const [connections, setConnections] = React.useState(EMPTY_ARRAY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [selectedConnection, setSelectedConnection] = React.useState(null);
  const [minLoadedPage, setMinLoadedPage] = React.useState(INITIAL_RESULTS_PAGE);
  const [maxLoadedPage, setMaxLoadedPage] = React.useState(INITIAL_RESULTS_PAGE);

  const debounceRef = React.useRef(null);
  const connectionsRef = React.useRef(null);
  const pendingPrependRef = React.useRef(null);
  const isInitialLoading = loading && connections.length === 0;

  function handleFromStationChange(value) {
    setFromStation(value);
    setFromStationId("");
  }

  function handleToStationChange(value) {
    setToStation(value);
    setToStationId("");
  }

  // Search from station suggestions
  React.useEffect(() => {
    clearTimeout(debounceRef.current);
    if (fromStation.length < 2) {
      debounceRef.current = setTimeout(() => setFromSuggestions(EMPTY_ARRAY), 0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const result = await searchStationsAction(fromStation);
      setFromSuggestions(result.stations || EMPTY_ARRAY);
    }, 300);
  }, [fromStation]);

  // Search to station suggestions
  React.useEffect(() => {
    clearTimeout(debounceRef.current);
    if (toStation.length < 2) {
      debounceRef.current = setTimeout(() => setToSuggestions(EMPTY_ARRAY), 0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const result = await searchStationsAction(toStation);
      setToSuggestions(result.stations || EMPTY_ARRAY);
    }, 300);
  }, [toStation]);

  function mergeConnections(existing, incoming, direction) {
    const seen = new Set();
    const merged = direction === "prepend" ? [...incoming, ...existing] : [...existing, ...incoming];

    return merged.filter((connection) => {
      const key = `${connection.departureIso}|${connection.arrivalIso}|${connection.from}|${connection.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getRelevantIso(connection) {
    return connection.departureIso;
  }

  function filterEdgeConnections(batch, direction, cursorIso) {
    const cursorParts = formatSwissDateTimeParts(cursorIso);
    if (!cursorParts) return EMPTY_ARRAY;
    const cursorTime = parseClockMinutes(cursorParts.time);
    if (cursorTime === null) return EMPTY_ARRAY;
    const searchTimeMinutes = parseClockMinutes(time);

    const filtered = batch.filter((connection) => {
      const departureParts = formatSwissDateTimeParts(connection.departureIso);
      const arrivalParts = formatSwissDateTimeParts(connection.arrivalIso);
      if (!departureParts || !arrivalParts) return false;

      const departureMinutes = parseClockMinutes(departureParts.time);
      const arrivalMinutes = parseClockMinutes(arrivalParts.time);
      if (departureMinutes === null || arrivalMinutes === null) return false;

      if (isArrival) {
        if (arrivalParts.date !== date || searchTimeMinutes === null || arrivalMinutes > searchTimeMinutes) {
          return false;
        }
      } else {
        if (departureParts.date !== date || searchTimeMinutes === null || departureMinutes < searchTimeMinutes) {
          return false;
        }
      }

      return direction === "before"
        ? departureMinutes < cursorTime
        : departureMinutes > cursorTime;
    });

    filtered.sort((a, b) => {
      const aTime = parseClockMinutes(formatSwissDateTimeParts(a.departureIso)?.time || "");
      const bTime = parseClockMinutes(formatSwissDateTimeParts(b.departureIso)?.time || "");
      if (aTime === null || bTime === null) return 0;
      return aTime - bTime;
    });

    return direction === "before" ? filtered.slice(-6) : filtered.slice(0, 6);
  }

  async function fetchEdgeConnections(direction) {
    if (connections.length === 0) return EMPTY_ARRAY;

    const cursorConnection = direction === "before" ? connections[0] : connections[connections.length - 1];
    const cursorIso = getRelevantIso(cursorConnection);
    if (!cursorIso) return EMPTY_ARRAY;

    const offsets = direction === "before"
      ? EDGE_WINDOWS_MINUTES.map((minutes) => -minutes)
      : [0];

    for (const offsetMinutes of offsets) {
      const cursorParts = formatSwissDateTimeParts(cursorIso);
      if (!cursorParts) continue;
      const swissParts = shiftSwissDateTimeParts(cursorParts.date, cursorParts.time, offsetMinutes);
      if (!swissParts) continue;

      const result = await searchConnectionsAction(
        fromStationId || fromStation,
        toStationId || toStation,
        swissParts.date,
        swissParts.time,
        false,
        0,
        false,
        EDGE_FETCH_LIMIT
      );

      if (result.error) {
        setError(result.error);
        return EMPTY_ARRAY;
      }

      const nextConnections = filterEdgeConnections(result.connections || EMPTY_ARRAY, direction, cursorIso);
      if (nextConnections.length > 0) {
        return nextConnections;
      }
    }

    return EMPTY_ARRAY;
  }

  React.useLayoutEffect(() => {
    const pendingPrepend = pendingPrependRef.current;
    if (!pendingPrepend || !connectionsRef.current) return;

    const nextHeight = connectionsRef.current.scrollHeight;
    const delta = nextHeight - pendingPrepend.previousHeight;
    if (delta !== 0) {
      window.scrollTo({ top: pendingPrepend.previousScrollY + delta });
    }
    pendingPrependRef.current = null;
  }, [connections]);

  async function fetchConnections(nextPage, direction = "replace") {
    setError("");
    setSelectedConnection(null);

    if (!fromStation.trim() || !toStation.trim()) {
      setError(t("sbb.errors.missingStations"));
      return false;
    }

    if (direction === "replace") {
      setConnections(EMPTY_ARRAY);
      setMinLoadedPage(nextPage);
      setMaxLoadedPage(nextPage);
      pendingPrependRef.current = null;
    } else if (direction === "prepend" && connectionsRef.current) {
      pendingPrependRef.current = {
        previousHeight: connectionsRef.current.scrollHeight,
        previousScrollY: window.scrollY,
      };
    } else {
      pendingPrependRef.current = null;
    }

    setLoading(true);
    // Use station ID if available, otherwise use the display name
    const fromParam = fromStationId || fromStation;
    const toParam = toStationId || toStation;

    const result = await searchConnectionsAction(
      fromParam,
      toParam,
      date,
      time,
      isArrival,
      nextPage,
      direction === "replace"
    );

    if (result.error) {
      setError(result.error);
      if (direction === "replace") {
        setConnections(EMPTY_ARRAY);
      }
      setLoading(false);
      return false;
    }

    const nextConnections = result.connections || EMPTY_ARRAY;
    if (nextConnections.length === 0 && direction === "replace") {
      setConnections(EMPTY_ARRAY);
      setError(t("sbb.errors.noConnections"));
      setLoading(false);
      return true;
    }

    if (direction === "replace") {
      setConnections(nextConnections);
      setMinLoadedPage(nextPage);
      setMaxLoadedPage(nextPage);
    } else if (direction === "prepend") {
      setConnections((existing) => mergeConnections(existing, nextConnections, "prepend"));
      setMinLoadedPage((current) => Math.min(current, nextPage));
    } else if (direction === "append") {
      setConnections((existing) => mergeConnections(existing, nextConnections, "append"));
      setMaxLoadedPage((current) => Math.max(current, nextPage));
    }

    setLoading(false);
    return true;
  }

  async function handleSearch(e) {
    e.preventDefault();
    await fetchConnections(INITIAL_RESULTS_PAGE);
  }

  async function handlePageChange(nextPage) {
    if (nextPage < minLoadedPage) {
      if (nextPage < 0) {
        setLoading(true);
        const nextConnections = await fetchEdgeConnections("before");
        if (nextConnections.length > 0) {
          if (connectionsRef.current) {
            pendingPrependRef.current = {
              previousHeight: connectionsRef.current.scrollHeight,
              previousScrollY: window.scrollY,
            };
          }
          setConnections((existing) => mergeConnections(existing, nextConnections, "prepend"));
        }
        setLoading(false);
        return;
      }
      await fetchConnections(nextPage, "prepend");
      return;
    }

    if (nextPage > maxLoadedPage) {
      if (nextPage > 3) {
        setLoading(true);
        const nextConnections = await fetchEdgeConnections("after");
        if (nextConnections.length > 0) {
          setConnections((existing) => mergeConnections(existing, nextConnections, "append"));
        }
        setLoading(false);
        return;
      }
      await fetchConnections(nextPage, "append");
      return;
    }
  }

  return (
    <SeniorNetPage title={t("sbb.title")}>
      <div className={styles.scope}>
        <div className="sbb-shell">
          {/* Search Form */}
          <form className="sbb-form" onSubmit={handleSearch}>
            <p className="sbb-form-intro">{t("sbb.formIntro")}</p>

            <div className="sbb-form-row">
              <StationAutocomplete
                label={t("sbb.from")}
                value={fromStation}
                onChange={handleFromStationChange}
                onSelect={(s) => {
                  setFromStation(s.name);
                  setFromStationId(s.id);
                }}
                suggestions={fromSuggestions}
              />
              <StationAutocomplete
                label={t("sbb.to")}
                value={toStation}
                onChange={handleToStationChange}
                onSelect={(s) => {
                  setToStation(s.name);
                  setToStationId(s.id);
                }}
                suggestions={toSuggestions}
              />
            </div>

            <div className="sbb-form-row">
              <div className="sbb-form-group">
                <label className="sbb-label">{t("sbb.date")}</label>
                <input
                  type="date"
                  className="sbb-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label={t("sbb.date")}
                />
              </div>

              <div className="sbb-form-group">
                <label className="sbb-label">{t("sbb.time")}</label>
                <input
                  type="time"
                  className="sbb-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label={t("sbb.time")}
                />
              </div>

              <div className="sbb-form-group">
                <label className="sbb-label">&nbsp;</label>
                <button
                  type="button"
                  className={`sbb-toggle ${isArrival ? "active" : ""}`}
                  onClick={() => setIsArrival(!isArrival)}
                  aria-pressed={isArrival}
                  title={isArrival ? t("sbb.arrival") : t("sbb.departure")}
                >
                  {isArrival ? t("sbb.arrival") : t("sbb.departure")}
                </button>
                <div className="sbb-search-hint">
                  {isArrival ? `${t("sbb.arrival")} vor ${time}` : `Start nach ${time}`}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={loading || !fromStation.trim() || !toStation.trim()}
              className="sbb-search-button"
              variant="primary"
              size="lg"
            >
              {isInitialLoading ? t("common.loading") : t("sbb.search")}
            </Button>

            {error && (
              <div className="sbb-error-box">
                <AlertCircle size={24} />
                <span>{error}</span>
              </div>
            )}
          </form>

          {/* Results */}
          <div className="sbb-results">
            {isInitialLoading && (
              <div className="sbb-loading">
                <Loader2 className="sbb-spinner" size={48} />
                <p>{t("sbb.loadingConnections")}</p>
              </div>
            )}

            {connections.length > 0 && (
              <div className="sbb-connections">
                <div ref={connectionsRef}>
                <div className="sbb-results-nav" aria-label={t("sbb.connectionNavigation")}>
                  <button
                    type="button"
                    className="sbb-results-nav-button sbb-results-nav-before"
                    onClick={() => handlePageChange(minLoadedPage - 1)}
                    disabled={loading}
                  >
                    {t("sbb.previousConnections")}
                  </button>
                </div>

                {connections.map((conn) => (
                  <ConnectionCard
                    key={getConnectionKey(conn)}
                    connection={conn}
                    onSelect={setSelectedConnection}
                  />
                ))}

                <div className="sbb-results-nav" aria-label={t("sbb.connectionNavigation")}>
                  <button
                    type="button"
                    className="sbb-results-nav-button sbb-results-nav-after"
                    onClick={() => handlePageChange(maxLoadedPage + 1)}
                    disabled={loading}
                  >
                    {t("sbb.nextConnections")}
                  </button>
                </div>
                </div>
              </div>
            )}

            {!loading && connections.length === 0 && !error && (
              <div className="sbb-empty">
                <Navigation size={48} />
                <p>{t("sbb.enterStations")}</p>
              </div>
            )}
          </div>

          {/* Detail modal */}
          {selectedConnection && (
            <div className="sbb-modal-overlay" onClick={() => setSelectedConnection(null)}>
              <div className="sbb-modal-content" onClick={(e) => e.stopPropagation()}>
                <ConnectionDetail
                  connection={selectedConnection}
                  onClose={() => setSelectedConnection(null)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </SeniorNetPage>
  );
}
