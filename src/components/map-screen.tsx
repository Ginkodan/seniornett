// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { Bike, Minus, Mountain, Plus, Search, X } from 'lucide-react';
import { useAppState } from './app-provider';
import styles from "./map-screen.module.css";

const SWITZERLAND_CENTER = [46.8182, 8.2275];
const SWITZERLAND_ZOOM = 8;
const MAP_LAYER_URL = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
const OVERLAY_LAYERS = {
  hiking: 'ch.swisstopo.swisstlm3d-wanderwege',
  cycling: 'ch.astra.veloland',
};

function createBaseLayer(L) {
  return L.tileLayer(MAP_LAYER_URL, {
    minZoom: 6,
    maxZoom: 18,
    crossOrigin: true,
  });
}

function createOverlayLayer(L, layerId) {
  return L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${layerId}/default/current/3857/{z}/{x}/{y}.png`, {
    minZoom: 6,
    maxZoom: 18,
    opacity: 0.95,
    crossOrigin: true,
  });
}

export function MapScreen() {
  const { t, locale } = useAppState();
  const mapElementRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const leafletRef = React.useRef(null);
  const baseLayerRef = React.useRef(null);
  const overlayLayersRef = React.useRef({});
  const [activeOverlay, setActiveOverlay] = React.useState('hiking');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchMarkerRef = React.useRef(null);
  const searchTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function setupMap() {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      if (disposed || !mapElementRef.current || mapInstanceRef.current) {
        return;
      }

      const map = L.map(mapElementRef.current, {
        attributionControl: false,
        zoomControl: false,
        minZoom: 6,
        maxZoom: 18,
      }).setView(SWITZERLAND_CENTER, SWITZERLAND_ZOOM);

      leafletRef.current = L;
      mapInstanceRef.current = map;

      baseLayerRef.current = createBaseLayer(L).addTo(map);

      // Initialize overlays immediately so default active layers are visible on first paint.
      Object.entries(OVERLAY_LAYERS).forEach(([key, layerId]) => {
        const layer = createOverlayLayer(L, layerId);
        overlayLayersRef.current[key] = layer;
        if (key === 'hiking') {
          layer.addTo(map);
        }
      });

      const invalidateMap = () => map.invalidateSize();

      map.whenReady(() => {
        invalidateMap();
      });
      window.requestAnimationFrame(invalidateMap);
      window.setTimeout(invalidateMap, 120);
      window.addEventListener('resize', invalidateMap);

      cleanup = () => {
        window.removeEventListener('resize', invalidateMap);
        map.remove();
        mapInstanceRef.current = null;
        leafletRef.current = null;
        baseLayerRef.current = null;
        overlayLayersRef.current = {};
      };
    }

    setupMap();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;

    if (!map || !L) {
      return;
    }

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }
    baseLayerRef.current = createBaseLayer(L).addTo(map);

    Object.entries(OVERLAY_LAYERS).forEach(([key, layerId]) => {
      if (!overlayLayersRef.current[key]) {
        overlayLayersRef.current[key] = createOverlayLayer(L, layerId);
      }

      const layer = overlayLayersRef.current[key];

      if (key === activeOverlay) {
        layer.addTo(map);
      } else {
        map.removeLayer(layer);
      }
    });

    window.requestAnimationFrame(() => map.invalidateSize());
  }, [activeOverlay]);

  function handleZoomIn() {
    mapInstanceRef.current?.zoomIn();
  }

  function handleZoomOut() {
    mapInstanceRef.current?.zoomOut();
  }

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  function handleSearchChange(e) {
    const query = e.target.value;
    setSearchQuery(query);
    setSearchOpen(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = new URL('https://api3.geo.admin.ch/rest/services/api/SearchServer');
        url.searchParams.set('searchText', query.trim());
        url.searchParams.set('type', 'locations');
        url.searchParams.set('lang', locale);
        url.searchParams.set('limit', '8');
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        // network error – silently ignore
      }
    }, 350);
  }

  function handleSelectResult(result) {
    const { lat, lon } = result.attrs;
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }
    searchMarkerRef.current = L.circleMarker([lat, lon], {
      radius: 10,
      fillColor: '#e63946',
      color: '#fff',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(map);

    map.setView([lat, lon], 14);
    setSearchQuery(stripHtml(result.attrs.label));
    setSearchResults([]);
    setSearchOpen(false);
  }

  function handleClearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    const map = mapInstanceRef.current;
    if (map && searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = null;
    }
  }

  return (
    <div className={`${styles.scope} app map-app`}>
      <div className="app-header">
        <h1 className="app-title">{t('map.title')}</h1>
        <div className="spacer" />
        <div className="map-title-actions" aria-label={t('map.layers')}>
          <button
            className={`map-toggle-btn ${activeOverlay === 'hiking' ? 'active' : ''}`}
            type="button"
            aria-label={t('map.hiking')}
            aria-pressed={activeOverlay === 'hiking'}
            title={t('map.hiking')}
            onClick={() => setActiveOverlay('hiking')}
          >
            <Mountain size={24} strokeWidth={2.4} />
          </button>
          <button
            className={`map-toggle-btn ${activeOverlay === 'cycling' ? 'active' : ''}`}
            type="button"
            aria-label={t('map.cycling')}
            aria-pressed={activeOverlay === 'cycling'}
            title={t('map.cycling')}
            onClick={() => setActiveOverlay('cycling')}
          >
            <Bike size={24} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="app-body map-app-body">
        <div className="map-screen">
          <div className="map-panel">
            <div className="map-frame">
              <div className="map-controls" aria-label={t('map.controls')}>
                <button
                  className="map-control-btn"
                  type="button"
                  onClick={handleZoomIn}
                  aria-label={t('map.zoomIn')}
                  title={t('map.zoomIn')}
                >
                  <Plus size={28} strokeWidth={2.75} />
                </button>
                <button
                  className="map-control-btn"
                  type="button"
                  onClick={handleZoomOut}
                  aria-label={t('map.zoomOut')}
                  title={t('map.zoomOut')}
                >
                  <Minus size={28} strokeWidth={2.75} />
                </button>
              </div>

              <div className="map-search">
                <div className="map-search-bar">
                  <Search size={22} strokeWidth={2.2} className="map-search-icon" aria-hidden="true" />
                  <input
                    className="map-search-input"
                    type="text"
                    placeholder={t('map.searchPlaceholder')}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                    onBlur={() => { setTimeout(() => setSearchOpen(false), 160); }}
                    aria-label={t('map.searchLabel')}
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      className="map-search-clear"
                      type="button"
                      onClick={handleClearSearch}
                      aria-label={t('map.clearSearch')}
                    >
                      <X size={20} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
                {searchOpen && searchResults.length > 0 && (
                  <ul className="map-search-results" role="listbox" aria-label={t('map.results')}>
                    {searchResults.map((result) => (
                      <li
                        key={result.id ?? result.attrs.geomStabId}
                        className="map-search-result-item"
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => handleSelectResult(result)}
                  >
                        {stripHtml(result.attrs.label)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                ref={mapElementRef}
                className="swiss-map-canvas"
                role="application"
                aria-label={t('map.aria')}
              />
              <span className="sr-only">
                {t('map.instructions')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
