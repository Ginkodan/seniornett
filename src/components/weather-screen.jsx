"use client";

import React from "react";

export function WeatherScreen({ fetchWeatherAction, searchLocationsAction }) {
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
    return fetchWeatherAction(place)
      .then((data) => setResult(data))
      .catch(() =>
        setResult({
          city: place || "Zürich",
          days: [],
          error: "Die Wetterdaten konnten nicht geladen werden.",
        })
      )
      .finally(() => setLoading(false));
  }, [fetchWeatherAction]);

  React.useEffect(() => {
    loadWeather("Zürich");
  }, []);

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
      searchLocationsAction(value.trim()).then((list) => {
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
        <h1 className="weather-city">{result?.city || "Wetter"}</h1>
        <p className="weather-subtitle">Wetterprognose für 5 Tage</p>
        <p className="weather-source">Quelle: MeteoSchweiz</p>
      </div>

      <form className="weather-search" onSubmit={handleSearchSubmit}>
        <label className="weather-search-label" htmlFor="weather-place-input">
          Ort suchen
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
              placeholder="z. B. Bern, Basel oder Luzern"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
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
            {loading ? "Lädt ..." : "Suchen"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="weather-loading">
          <p>Wetterdaten werden geladen ...</p>
        </div>
      )}

      {!loading && (result?.error || !result?.days?.length) && (
        <div className="weather-error">
          <p>
            {result?.error ||
              "Wetterdaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut."}
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
                        ? "Wenig Niederschlag"
                        : `${day.precipMm} mm Niederschlag`}
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
