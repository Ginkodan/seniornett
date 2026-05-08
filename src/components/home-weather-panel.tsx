"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { useAppState } from "./app-provider";
import { Button, ModalOverlay, TextField } from "./ui";
import type { DayForecast, WeatherLocation, WeatherResult } from "@/app/actions/weather";
import styles from "./home-weather-panel.module.css";

type HomeWeatherPanelProps = {
  initialWeather: WeatherResult | null;
  fetchWeatherAction: (query?: string, language?: string, location?: WeatherLocation) => Promise<WeatherResult>;
  searchLocationsAction?: (query: string, language?: string) => Promise<string[]>;
};

export function HomeWeatherPanel({
  initialWeather,
  fetchWeatherAction,
  searchLocationsAction,
}: HomeWeatherPanelProps) {
  const { t, locale } = useAppState();
  const [weather, setWeather] = React.useState<WeatherResult | null>(initialWeather);
  const [loading, setLoading] = React.useState(!initialWeather);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState(initialWeather?.city || "");
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const debounceRef = React.useRef<number | null>(null);

  const summary = weather?.days?.[0];
  const isReady = Boolean(summary && !weather?.error);

  React.useEffect(() => {
    if (initialWeather) {
      return;
    }

    let cancelled = false;

    async function loadInitialWeather() {
      if (!navigator.geolocation) {
        if (!cancelled) {
          setWeather({ city: "", days: [], error: t("weather.locationError") });
          setLoading(false);
        }
        return;
      }

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
              }
            );
            if (cancelled) return;
            setWeather(nextWeather);
            setSearchTerm(nextWeather.city || "");
          } catch {
            if (!cancelled) {
              setWeather({ city: "", days: [], error: t("weather.locationError") });
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        },
        () => {
          if (!cancelled) {
            setWeather({ city: "", days: [], error: t("weather.locationError") });
            setLoading(false);
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    }

    void loadInitialWeather();

    return () => {
      cancelled = true;
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
      const nextWeather = await fetchWeatherAction(place, locale);
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
    void fetchWeatherAction(label, locale)
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

  const days: DayForecast[] = weather?.days?.slice(0, 5) ?? [];

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
                <article key={day.date} className={`home-weather-day-card ${index === 0 ? "home-weather-day-card--today" : ""}`}>
                  <p className="home-weather-day-label">{formatShortDayLabel(day.date)}</p>
                  <div className="home-weather-day-emoji" aria-hidden="true">
                    {day.emoji}
                  </div>
                  <p className="home-weather-day-temps">
                    <span>{day.tempMax}°</span>
                    <span className="home-weather-day-temps-sep"> / </span>
                    <span>{day.tempMin}°</span>
                  </p>
                </article>
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
    </>
  );
}
