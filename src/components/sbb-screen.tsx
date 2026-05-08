// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { MapPin, AlertCircle, Loader2, X, Navigation, Footprints } from "lucide-react";
import { searchStationsAction, searchConnectionsAction } from "@/app/actions/sbb";
import { useAppState } from "./app-provider";
import { Button, SeniorNetPage } from "./ui";
import {
  EMPTY_ARRAY,
  buildTransferMarkers,
  formatTransferMinutes,
  formatWalkDistanceMeters,
  getConnectionRealtimeState,
  getDisplayLegs,
  getLegRealtimeStatus,
  getSwissNowDefaults,
  getTransferDetails,
  getTransferStatusMeta,
  getTransportIcon,
  getPlatformLabel,
} from "./sbb-screen.helpers";
import styles from "./sbb-screen.module.css";

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
        {accessAssessment && (
          <div
            className="sbb-timeline-marker sbb-timeline-marker-access sbb-timeline-marker-access-start"
            style={{ left: "2%" }}
            title={accessSummary || t("sbb.access.walk")}
            aria-hidden="true"
          >
            <span className="sbb-timeline-dot sbb-timeline-dot-access" />
            <span className="sbb-timeline-access-icon">
              <Footprints size={13} />
            </span>
          </div>
        )}
        {destinationAssessment && (
          <div
            className="sbb-timeline-marker sbb-timeline-marker-access sbb-timeline-marker-access-end"
            style={{ left: "98%" }}
            title={destinationSummary || t("sbb.access.walk")}
            aria-hidden="true"
          >
            <span className="sbb-timeline-dot sbb-timeline-dot-access" />
            <span className="sbb-timeline-access-icon">
              <Footprints size={13} />
            </span>
          </div>
        )}
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

  const debounceRef = React.useRef(null);
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

  async function fetchConnections() {
    setError("");
    setSelectedConnection(null);

    if (!fromStation.trim() || !toStation.trim()) {
      setError(t("sbb.errors.missingStations"));
      return false;
    }

    setLoading(true);

    const fromParam = fromStationId || fromStation;
    const toParam = toStationId || toStation;
    const result = await searchConnectionsAction(
      fromParam,
      toParam,
      date,
      time,
      isArrival,
      1,
      true
    );

    if (result.error) {
      setError(result.error);
      setConnections(EMPTY_ARRAY);
      setLoading(false);
      return false;
    }

    const nextConnections = result.connections || EMPTY_ARRAY;
    if (nextConnections.length === 0) {
      setConnections(EMPTY_ARRAY);
      setError(t("sbb.errors.noConnections"));
    } else {
      setConnections(nextConnections);
    }

    setLoading(false);
    return true;
  }

  async function handleSearch(e) {
    e.preventDefault();
    await fetchConnections();
  }

  return (
    <SeniorNetPage title={t("sbb.title")} subtitle={t("sbb.subtitle")} tone="teal">
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
                {connections.map((conn) => (
                  <ConnectionCard
                    key={getConnectionKey(conn)}
                    connection={conn}
                    onSelect={setSelectedConnection}
                  />
                ))}
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
