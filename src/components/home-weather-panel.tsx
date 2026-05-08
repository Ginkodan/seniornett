"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { useAppState } from "./app-provider";
import { Button, ModalOverlay, TextField } from "./ui";
import type { DayForecast, WeatherLocation, WeatherResult } from "@/app/actions/weather";
import { readJsonFromStorage, writeJsonToStorage } from "@/lib/shared/client-storage";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./home-weather-panel.module.css";

const WEATHER_CACHE_PREFIX = "seniornett-weather-cache-v1";
const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000;

type HomeWeatherPanelProps = {
  initialWeather: WeatherResult | null;
  fetchWeatherAction: (
    query?: string,
    language?: string,
    location?: WeatherLocation,
    options?: { includeHourly?: boolean }
  ) => Promise<WeatherResult>;
  searchLocationsAction?: (query: string, language?: string) => Promise<string[]>;
};

type WeatherChartSectionProps = {
  title: string;
  note: string;
  legend: React.ReactNode;
  children: React.ReactNode;
};

function WeatherChartSection({ title, note, legend, children }: WeatherChartSectionProps) {
  return (
    <section className="home-weather-chart-section">
      <div className="home-weather-hourly-head">
        <h3 className="home-weather-hourly-title">{title}</h3>
        <p className="home-weather-hourly-note">{note}</p>
      </div>
      <div className="home-weather-chart-legend" aria-label={title}>
        {legend}
      </div>
      <div className="home-weather-chart-frame" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

function weatherCacheKey(localeTag: string) {
  return `${WEATHER_CACHE_PREFIX}:${localeTag}`;
}

function readWeatherCache(localeTag: string): { savedAt: number; weather: WeatherResult } | null {
  const cached = readJsonFromStorage<{ savedAt: number; weather: WeatherResult } | null>(
    weatherCacheKey(localeTag),
    null
  );

  if (!cached?.weather || typeof cached.savedAt !== "number") {
    return null;
  }

  if (Date.now() - cached.savedAt > WEATHER_CACHE_TTL_MS) {
    return null;
  }

  return cached;
}

function writeWeatherCache(localeTag: string, weather: WeatherResult): void {
  if (weather.error) {
    return;
  }

  writeJsonToStorage(weatherCacheKey(localeTag), {
    savedAt: Date.now(),
    weather,
  });
}

export function HomeWeatherPanel({
  initialWeather,
  fetchWeatherAction,
  searchLocationsAction,
}: HomeWeatherPanelProps) {
  const { t, locale, localeTag } = useAppState();
  const cachedWeather = React.useMemo(() => readWeatherCache(localeTag), [localeTag]);
  const [weather, setWeather] = React.useState<WeatherResult | null>(initialWeather);
  const [loading, setLoading] = React.useState(() => !initialWeather && !cachedWeather);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState(initialWeather?.city || cachedWeather?.weather.city || "");
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [selectedDay, setSelectedDay] = React.useState<DayForecast | null>(null);

  const debounceRef = React.useRef<number | null>(null);
  const locationLoadedRef = React.useRef(false);
  const hourlyPrefetchRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!initialWeather && cachedWeather?.weather && !weather) {
      setWeather(cachedWeather.weather);
      setSearchTerm(cachedWeather.weather.city || "");
      setLoading(false);
    }
  }, [cachedWeather, initialWeather, weather]);

  const summary = weather?.days?.[0];
  const isReady = Boolean(summary && !weather?.error);

  React.useEffect(() => {
    if (initialWeather) {
      return;
    }

    let cancelled = false;
    let fallbackTimer: number | null = null;
    locationLoadedRef.current = false;

    async function loadFallbackWeather() {
      if (cancelled || locationLoadedRef.current) {
        return;
      }

      try {
        const nextWeather = await fetchWeatherAction(undefined, locale, undefined, { includeHourly: false });
        if (cancelled || locationLoadedRef.current) {
          return;
        }
        setWeather(nextWeather);
        setSearchTerm(nextWeather.city || "");
      } catch {
        if (!cancelled && !locationLoadedRef.current) {
          setWeather({ city: "", days: [], error: t("weather.locationError") });
        }
      } finally {
        if (!cancelled && !locationLoadedRef.current) {
          setLoading(false);
        }
      }
    }

    async function loadInitialWeather() {
      if (!navigator.geolocation) {
        void loadFallbackWeather();
        return;
      }

      fallbackTimer = window.setTimeout(() => {
        void loadFallbackWeather();
      }, 6000);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (cancelled) return;
          try {
            const nextWeather = await fetchWeatherAction(
              undefined,
              locale,
              {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
              { includeHourly: false }
            );
            if (cancelled) return;
            locationLoadedRef.current = true;
            setWeather(nextWeather);
            setSearchTerm(nextWeather.city || "");
          } catch {
            if (!cancelled && !locationLoadedRef.current) {
              void loadFallbackWeather();
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        },
        () => {
          void loadFallbackWeather();
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 }
      );
    }

    void loadInitialWeather();

    return () => {
      cancelled = true;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [fetchWeatherAction, initialWeather, locale, t]);

  React.useEffect(
    () => () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!weather || weather.error) {
      return;
    }

    writeWeatherCache(localeTag, weather);
  }, [localeTag, weather]);

  React.useEffect(() => {
    if (!weather?.city || weather.error || weather.days.length === 0 || weather.days[0]?.hourly?.length) {
      return;
    }

    const prefetchKey = `${localeTag}:${weather.city}`;
    if (hourlyPrefetchRef.current === prefetchKey) {
      return;
    }

    hourlyPrefetchRef.current = prefetchKey;
    const timeoutId = window.setTimeout(() => {
      void fetchWeatherAction(weather.city, locale, undefined, { includeHourly: true })
        .then((nextWeather) => {
          if (nextWeather?.days?.length && !nextWeather.error) {
            setWeather(nextWeather);
          }
        })
        .catch(() => {
          // Keep the lightweight overview if the background prefetch fails.
        });
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchWeatherAction, locale, localeTag, weather]);

  React.useEffect(() => {
    if (!selectedDay || !weather?.days?.length) {
      return;
    }

    const refreshed = weather.days.find((day) => day.date === selectedDay.date);
    if (refreshed && refreshed !== selectedDay && refreshed.hourly?.length) {
      setSelectedDay(refreshed);
    }
  }, [selectedDay, weather]);

  function queueSuggestions(value: string) {
    if (!searchLocationsAction) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      searchLocationsAction(value.trim(), locale)
        .then((list) => {
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
        });
    }, 260);
  }

  function openSearch() {
    setSearchOpen(true);
    setSearchTerm(weather?.city || "");
    setShowSuggestions(false);
    setActiveIndex(-1);
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const place = searchTerm.trim() || weather?.city;
    if (!place) {
      return;
    }
    setLoading(true);
    try {
      const nextWeather = await fetchWeatherAction(place, locale, undefined, { includeHourly: false });
      setWeather(nextWeather);
      if (nextWeather?.city) {
        setSearchTerm(nextWeather.city);
      }
    } catch {
      setWeather({ city: place, days: [], error: t("weather.error") });
    } finally {
      setLoading(false);
      setSearchOpen(false);
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  function handleSuggestionPick(label: string) {
    setSearchTerm(label);
    setSearchOpen(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setLoading(true);
    void fetchWeatherAction(label, locale, undefined, { includeHourly: false })
      .then((nextWeather) => {
        setWeather(nextWeather);
        if (nextWeather?.city) {
          setSearchTerm(nextWeather.city);
        }
      })
      .catch(() => {
        setWeather({ city: label, days: [], error: t("weather.error") });
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function formatShortDayLabel(date: string) {
    const value = new Date(`${date}T00:00:00Z`);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(value);
  }

  function formatLongDayLabel(date: string) {
    const value = new Date(`${date}T00:00:00Z`);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(value);
  }

  const days: DayForecast[] = weather?.days?.slice(0, 5) ?? [];

  const selectedDayDetails = React.useMemo(() => {
    if (!selectedDay) {
      return null;
    }

    return weather?.days.find((entry) => entry.date === selectedDay.date) ?? selectedDay;
  }, [selectedDay, weather]);

  const selectedHourlySeries = selectedDayDetails?.hourly ?? [];
  type WeatherChartPoint = {
    slotIndex: number;
    time: string;
    temp: number | null;
    sunshine: number | null;
    rain: number;
    snow: number;
    wind: number | null;
    gust: number | null;
    direction: number | null;
  };
  const weatherChartPoints: WeatherChartPoint[] = selectedHourlySeries.map((slot, index) => ({
    slotIndex: index,
    time: slot.time,
    temp: slot.temp ?? null,
    sunshine: slot.sunshinePct ?? null,
    rain: slot.precipMm ?? 0,
    snow: slot.snow ? slot.precipMm ?? 0 : 0,
    wind: slot.windSpeed ?? null,
    gust: slot.windGust ?? null,
    direction: slot.windDirection ?? null,
  }));
  const weatherTickCount = Math.min(6, Math.max(2, weatherChartPoints.length));
  function formatChartTimeTick(value: number) {
    return weatherChartPoints[Math.round(value)]?.time ?? "";
  }
  const maxHourlyWind =
    selectedHourlySeries.length > 0
      ? Math.max(0, ...selectedHourlySeries.map((slot) => slot.windGust ?? slot.windSpeed ?? 0))
      : 0;
  const maxHourlyPrecip = Math.max(
    1,
    ...selectedHourlySeries.flatMap((slot) => [slot.precipMm ?? 0, slot.snow ? slot.precipMm ?? 0 : 0])
  );
  const snowText = selectedHourlySeries.some((slot) => slot.snow)
    ? t("weather.dayDetailsSnowPossible")
    : t("weather.dayDetailsSnowNone");

  async function loadSelectedDayDetails(day: DayForecast) {
    const currentDay = weather?.days.find((entry) => entry.date === day.date) ?? day;

    if (!weather?.city || currentDay.hourly?.length) {
      setSelectedDay(currentDay);
      return;
    }

    try {
      const detailedWeather = await fetchWeatherAction(weather.city, locale, undefined, { includeHourly: true });
      setWeather(detailedWeather);
      const detailedDay = detailedWeather.days.find((entry) => entry.date === day.date) ?? currentDay;
      setSelectedDay(detailedDay);
    } catch {
      // Keep the summary view if the detailed fetch fails.
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSuggestionPick(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  function handleSearchInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchTerm(value);
    setActiveIndex(-1);
    queueSuggestions(value);
  }

  function renderWeatherChartTooltip(section: "sunshine" | "precip" | "wind") {
    return function chartTooltip(props: unknown) {
      const { active, payload } = props as {
        active?: boolean;
        payload?: Array<{ payload?: WeatherChartPoint }>;
      };

      if (!active || !payload?.length) {
        return null;
      }

      const point = payload[0]?.payload as WeatherChartPoint | undefined;
      if (!point) {
        return null;
      }

      return (
        <div className="home-weather-chart-tooltip">
          <strong className="home-weather-chart-tooltip-time">{point.time}</strong>
          {section === "sunshine" ? (
            <>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendTemperature")}: {point.temp ?? "—"}°
              </span>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendSunshine")}: {point.sunshine ?? "—"}%
              </span>
            </>
          ) : null}
          {section === "precip" ? (
            <>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendRain")}: {point.rain > 0 ? `${point.rain} mm` : t("weather.dayDetailsDry")}
              </span>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendSnow")}: {point.snow > 0 ? `${point.snow} mm` : t("weather.dayDetailsDry")}
              </span>
            </>
          ) : null}
          {section === "wind" ? (
            <>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendWindSpeed")}: {point.wind ?? "—"} km/h
              </span>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendWindGust")}: {point.gust ?? "—"} km/h
              </span>
              <span className="home-weather-chart-tooltip-row">
                {t("weather.chartLegendWindDirection")}: {point.direction ?? "—"}°
              </span>
            </>
          ) : null}
        </div>
      );
    };
  }

  function renderWindDirectionShape(props: unknown) {
    const { cx, cy, payload } = props as {
      cx?: number;
      cy?: number;
      payload?: WeatherChartPoint;
    };

    if (cx == null || cy == null || payload?.direction == null) {
      return null;
    }

    const rotation = (payload.direction + 180) % 360;

    return (
      <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
        <circle cx={0} cy={0} r={4.5} fill="color-mix(in srgb, var(--paper) 88%, white)" opacity={0.88} />
        <path
          d="M -8 0 L 3 0 M 3 0 L -1 -4 M 3 0 L -1 4"
          stroke="var(--ink)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.95}
        />
      </g>
    );
  }

  return (
    <>
      <section className={styles.scope}>
        <div className="home-weather-panel" aria-label={t("weather.title")}>
          <div className="home-weather-panel-head">
            <div className="home-weather-location">
              <h2 className="home-weather-city">{weather?.city || t("weather.title")}</h2>
              <button
                type="button"
                className="home-weather-search-trigger home-weather-search-trigger-inline"
                onClick={openSearch}
                aria-label={t("weather.changeLocation")}
                title={t("weather.changeLocation")}
              >
                <MapPin size={14} aria-hidden="true" focusable="false" />
              </button>
            </div>
          </div>

          {loading ? (
            <p className="home-weather-status">{t("weather.loading")}</p>
          ) : weather?.error ? (
            <p className="home-weather-status">{weather.error}</p>
          ) : isReady ? (
            <div className="home-weather-days" aria-label={t("weather.subtitle")}>
              {days.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  className={`home-weather-day-card home-weather-day-button ${index === 0 ? "home-weather-day-card--today" : ""}`}
                  onClick={() => {
                    const currentDay = weather.days.find((entry) => entry.date === day.date) ?? day;
                    setSelectedDay(currentDay);
                    void loadSelectedDayDetails(currentDay);
                  }}
                  aria-label={t("weather.openDayDetails", {
                    day: formatLongDayLabel(day.date),
                    high: `${day.tempMax}°`,
                    low: `${day.tempMin}°`,
                  })}
                >
                  <p className="home-weather-day-label">{formatShortDayLabel(day.date)}</p>
                  <div className="home-weather-day-emoji" aria-hidden="true">
                    {day.emoji}
                  </div>
                  <p className="home-weather-day-temps">
                    <span>{day.tempMax}°</span>
                    <span className="home-weather-day-temps-sep"> / </span>
                    <span>{day.tempMin}°</span>
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="home-weather-status">
              {loading && !weather ? t("weather.locationLoading") : t("weather.loading")}
            </p>
          )}
        </div>
      </section>

      <div className={styles.scope}>
        <ModalOverlay
          open={searchOpen}
          eyebrow={t("weather.title")}
          title={t("weather.searchLabel")}
          closeLabel={t("common.close")}
          onClose={() => {
            setSearchOpen(false);
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveIndex(-1);
          }}
          className="home-weather-overlay"
        >
          <form className="home-weather-search" onSubmit={handleSearchSubmit}>
            <TextField
              label={t("weather.searchLabel")}
              hideLabel
              helpText={t("weather.searchHelp")}
              value={searchTerm}
              onChange={handleSearchInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={t("weather.searchPlaceholder")}
              autoComplete="off"
              autoFocus
              aria-autocomplete="list"
              aria-controls={showSuggestions ? "home-weather-suggestions" : undefined}
              aria-activedescendant={activeIndex >= 0 ? `home-weather-suggestion-${activeIndex}` : undefined}
            />

            {showSuggestions && suggestions.length > 0 ? (
              <div id="home-weather-suggestions" className="home-weather-suggestions" role="listbox">
                {suggestions.map((label, index) => (
                  <button
                    key={label}
                    id={`home-weather-suggestion-${index}`}
                    type="button"
                    className={`home-weather-suggestion ${index === activeIndex ? "home-weather-suggestion--active" : ""}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      handleSuggestionPick(label);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="home-weather-search-actions">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? t("weather.loadingButton") : t("weather.searchButton")}
              </Button>
            </div>
          </form>
        </ModalOverlay>
      </div>

      <div className={styles.scope}>
        <ModalOverlay
          open={Boolean(selectedDay)}
          eyebrow={weather?.city || t("weather.title")}
          title={selectedDayDetails ? formatLongDayLabel(selectedDayDetails.date) : t("weather.title")}
          closeLabel={t("common.close")}
          onClose={() => setSelectedDay(null)}
          className="home-weather-overlay home-weather-day-overlay"
        >
              {selectedDayDetails ? (
            <div className="home-weather-day-details">
              <div className="home-weather-day-summary">
                <div className="home-weather-day-summary-icon" aria-hidden="true">
                  {selectedDayDetails.emoji}
                </div>
                <div className="home-weather-day-summary-copy">
                  <p className="home-weather-day-summary-label">{selectedDayDetails.label}</p>
                  <p className="home-weather-day-summary-note">{t("weather.dayDetailsNote")}</p>
                </div>
              </div>

              {!selectedDayDetails.hourly?.length ? (
                <p className="home-weather-day-loading">{t("weather.loading")}</p>
              ) : null}

              <div className="home-weather-day-metrics" aria-label={t("weather.dayDetailsMetrics")}>
                <div className="home-weather-day-metric">
                  <span className="home-weather-day-metric-label">{t("weather.dayDetailsTemperature")}</span>
                  <strong className="home-weather-day-metric-value">{selectedDayDetails.tempMax}° / {selectedDayDetails.tempMin}°</strong>
                </div>
                <div className="home-weather-day-metric">
                  <span className="home-weather-day-metric-label">{t("weather.dayDetailsRain")}</span>
                  <strong className="home-weather-day-metric-value">
                    {selectedDayDetails.precipMm > 0 ? `${selectedDayDetails.precipMm} mm` : t("weather.dayDetailsDry")}
                  </strong>
                </div>
                <div className="home-weather-day-metric">
                  <span className="home-weather-day-metric-label">{t("weather.dayDetailsWind")}</span>
                  <strong className="home-weather-day-metric-value">
                    {selectedHourlySeries.length > 0 ? `${maxHourlyWind} km/h` : "—"}
                  </strong>
                </div>
                <div className="home-weather-day-metric">
                  <span className="home-weather-day-metric-label">{t("weather.dayDetailsSnow")}</span>
                  <strong className="home-weather-day-metric-value">{snowText}</strong>
                </div>
              </div>

              {weatherChartPoints.length > 0 ? (
                <div className="home-weather-charts">
                  <WeatherChartSection
                    title={t("weather.chartSunshineTitle")}
                    note={t("weather.chartSunshineNote")}
                    legend={
                      <>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--line"
                            style={{ backgroundColor: "var(--ink)", borderColor: "var(--ink)" }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendTemperature")} °C</span>
                        </span>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--area"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--page-accent, var(--info)) 18%, white)",
                              borderColor: "color-mix(in srgb, var(--page-accent, var(--info)) 40%, white)",
                            }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendSunshine")}</span>
                        </span>
                      </>
                    }
                  >
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={weatherChartPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(32,29,25,0.10)" />
                        <XAxis
                          dataKey="slotIndex"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          domain={["dataMin", "dataMax"]}
                          tickCount={weatherTickCount}
                          tickFormatter={formatChartTimeTick}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                        />
                        <YAxis
                          yAxisId="temp"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                          width={42}
                          domain={["dataMin - 1", "dataMax + 1"]}
                        />
                        <YAxis
                          yAxisId="sunshine"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                          width={40}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={renderWeatherChartTooltip("sunshine")} />
                        <Area
                          yAxisId="sunshine"
                          type="monotone"
                          dataKey="sunshine"
                          stroke="color-mix(in srgb, var(--page-accent, var(--info)) 82%, white)"
                          fill="color-mix(in srgb, var(--page-accent, var(--info)) 18%, white)"
                          fillOpacity={1}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          dataKey="temp"
                          stroke="var(--ink)"
                          strokeWidth={2.8}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </WeatherChartSection>

                  <WeatherChartSection
                    title={t("weather.chartRainTitle")}
                    note={t("weather.chartRainNote")}
                    legend={
                      <>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--bar"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--page-accent, var(--info)) 52%, white)",
                              borderColor: "color-mix(in srgb, var(--page-accent, var(--info)) 52%, white)",
                            }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendRain")}</span>
                        </span>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--bar"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--ink-3) 22%, white)",
                              borderColor: "color-mix(in srgb, var(--ink-3) 22%, white)",
                            }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendSnow")}</span>
                        </span>
                      </>
                    }
                  >
                    <ResponsiveContainer width="100%" height={210}>
                      <ComposedChart data={weatherChartPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(32,29,25,0.10)" />
                        <XAxis
                          dataKey="slotIndex"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          domain={["dataMin", "dataMax"]}
                          tickCount={weatherTickCount}
                          tickFormatter={formatChartTimeTick}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                        />
                        <YAxis
                          yAxisId="precip"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                          width={42}
                          domain={[0, maxHourlyPrecip + 1]}
                          tickFormatter={(value) => `${value} mm`}
                        />
                        <YAxis
                          yAxisId="snow"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                          width={42}
                          domain={[0, maxHourlyPrecip + 1]}
                          tickFormatter={(value) => `${value} mm`}
                        />
                        <Tooltip content={renderWeatherChartTooltip("precip")} />
                        <Bar
                          yAxisId="precip"
                          dataKey="rain"
                          fill="color-mix(in srgb, var(--page-accent, var(--info)) 52%, white)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={14}
                          barSize={8}
                        />
                        <Bar
                          yAxisId="snow"
                          dataKey="snow"
                          fill="color-mix(in srgb, var(--ink-3) 22%, white)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={14}
                          barSize={8}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </WeatherChartSection>

                  <WeatherChartSection
                    title={t("weather.chartWindTitle")}
                    note={t("weather.chartWindNote")}
                    legend={
                      <>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--line"
                            style={{ backgroundColor: "var(--ink)", borderColor: "var(--ink)" }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendWindSpeed")}</span>
                        </span>
                        <span className="home-weather-chart-legend-item">
                          <span
                            className="home-weather-chart-legend-swatch home-weather-chart-legend-swatch--dash"
                            style={{
                              backgroundColor: "transparent",
                              borderColor: "color-mix(in srgb, var(--page-accent, var(--info)) 75%, white)",
                            }}
                            aria-hidden="true"
                          />
                          <span>{t("weather.chartLegendWindGust")}</span>
                        </span>
                        <span className="home-weather-chart-legend-item">
                          <span className="home-weather-chart-legend-arrow" aria-hidden="true">
                            →
                          </span>
                          <span>{t("weather.chartLegendWindDirection")}</span>
                        </span>
                      </>
                    }
                  >
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={weatherChartPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(32,29,25,0.10)" />
                        <XAxis
                          dataKey="slotIndex"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          domain={["dataMin", "dataMax"]}
                          tickCount={weatherTickCount}
                          tickFormatter={formatChartTimeTick}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--ink-3)", fontSize: 12, fontWeight: 700 }}
                          width={42}
                          domain={[0, Math.max(1, maxHourlyWind + 5)]}
                          tickFormatter={(value) => `${value} km/h`}
                        />
                        <Tooltip content={renderWeatherChartTooltip("wind")} />
                        <Line
                          type="monotone"
                          dataKey="wind"
                          stroke="var(--ink)"
                          strokeWidth={2.8}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="gust"
                          stroke="color-mix(in srgb, var(--page-accent, var(--info)) 78%, white)"
                          strokeWidth={2.2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls
                        />
                        <Scatter
                          data={weatherChartPoints}
                          dataKey="wind"
                          shape={renderWindDirectionShape}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </WeatherChartSection>
                </div>
              ) : null}
            </div>
          ) : null}
        </ModalOverlay>
      </div>
    </>
  );
}
