// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { useAppState } from "./app-provider";

export function WeatherScreen({ fetchWeatherAction, searchLocationsAction }) {
  const { t, locale } = useAppState();
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("Zürich");
  const [suggestions, setSuggestions] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const wrapRef = React.useRef(null);
  const debounceRef = React.useRef(null);

  const loadWeather = React.useCallback((place) => {
    setLoading(true);
    return fetchWeatherAction(place, locale)
      .then((data) => setResult(data))
      .catch(() =>
        setResult({
          city: place || "Zürich",
          days: [],
          error: t("weather.error"),
        })
      )
      .finally(() => setLoading(false));
  }, [fetchWeatherAction, locale, t]);

  React.useEffect(() => {
    // Kick off the initial weather fetch once the screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWeather("Zürich");
  }, [loadWeather]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handlePointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleInputChange(event) {
    const value = event.target.value;
    setSearchTerm(value);
    setActiveIndex(-1);

    clearTimeout(debounceRef.current);
    if (!searchLocationsAction || value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
        searchLocationsAction(value.trim(), locale).then((list) => {
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        });
    }, 280);
  }

  function handleSuggestionPick(label) {
    setSearchTerm(label);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    loadWeather(label);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSuggestions([]);
    setShowSuggestions(false);
    const place = searchTerm.trim();
    loadWeather(place || "Zürich");
  }

  function handleKeyDown(event) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSuggestionPick(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="weather-screen">
      <div className="weather-header">
        <h1 className="weather-city">{result?.city || t("weather.title")}</h1>
        <p className="weather-subtitle">{t("weather.subtitle")}</p>
        <p className="weather-source">{t("weather.source")}</p>
      </div>

      <form className="weather-search" onSubmit={handleSearchSubmit}>
        <label className="weather-search-label" htmlFor="weather-place-input">
          {t("weather.searchLabel")}
        </label>
        <div className="weather-search-row">
          <div className="weather-search-wrap" ref={wrapRef}>
            <input
              id="weather-place-input"
              type="text"
              className="weather-search-input"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={t("weather.searchPlaceholder")}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="weather-suggestions"
              aria-activedescendant={
                activeIndex >= 0 ? `weather-suggestion-${activeIndex}` : undefined
              }
            />
            {showSuggestions && (
              <ul
                id="weather-suggestions"
                className="weather-suggestions"
                role="listbox"
              >
                {suggestions.map((label, index) => (
                  <li
                    key={label}
                    id={`weather-suggestion-${index}`}
                    className={
                      "weather-suggestion-item" +
                      (index === activeIndex ? " weather-suggestion-item--active" : "")
                    }
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSuggestionPick(label);
                    }}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="weather-search-btn" disabled={loading}>
            {loading ? t("weather.loadingButton") : t("weather.searchButton")}
          </button>
        </div>
      </form>

      {loading && (
        <div className="weather-loading">
          <p>{t("weather.loading")}</p>
        </div>
      )}

      {!loading && (result?.error || !result?.days?.length) && (
        <div className="weather-error">
          <p>
            {result?.error ||
              t("weather.error")}
          </p>
        </div>
      )}

      {!loading && result?.days?.length > 0 && (
        <div className="weather-list">
          {result.days.map((day) => (
            <div key={day.date} className="weather-card">
              <div className="weather-card-top">
                <span className="weather-day">{day.dayLabel}</span>
              </div>
              <div className="weather-card-body">
                <span className="weather-emoji" role="img" aria-label={day.label}>
                  {day.emoji}
                </span>
                <div className="weather-card-info">
                  <span className="weather-label">{day.label}</span>
                  <span className="weather-temps">
                    <span className="weather-temp-max">{day.tempMax}°</span>
                    <span className="weather-temp-sep"> / </span>
                    <span className="weather-temp-min">{day.tempMin}°</span>
                  </span>
                  {day.precipMm > 0 && (
                    <span className="weather-precip">
                      {day.precipMm < 1
                        ? t("weather.conditions.lightPrecipitation")
                        : t("weather.conditions.precipitation", { amount: day.precipMm })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
