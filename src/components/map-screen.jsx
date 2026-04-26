"use client";

import React from 'react';
import { Bike, Minus, Mountain, Plus } from 'lucide-react';

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
  const mapElementRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const leafletRef = React.useRef(null);
  const baseLayerRef = React.useRef(null);
  const overlayLayersRef = React.useRef({});
  const [activeOverlay, setActiveOverlay] = React.useState('hiking');

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

  return (
    <div className="app map-app">
      <div className="app-header">
        <h1 className="app-title">Karte</h1>
        <div className="spacer" />
        <div className="map-title-actions" aria-label="Kartenebenen">
          <button
            className={`map-toggle-btn ${activeOverlay === 'hiking' ? 'active' : ''}`}
            type="button"
            aria-label="Wanderwege"
            aria-pressed={activeOverlay === 'hiking'}
            title="Wanderwege"
            onClick={() => setActiveOverlay('hiking')}
          >
            <Mountain size={24} strokeWidth={2.4} />
          </button>
          <button
            className={`map-toggle-btn ${activeOverlay === 'cycling' ? 'active' : ''}`}
            type="button"
            aria-label="Veloland"
            aria-pressed={activeOverlay === 'cycling'}
            title="Veloland"
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
              <div className="map-controls" aria-label="Kartensteuerung">
                <button
                  className="map-control-btn"
                  type="button"
                  onClick={handleZoomIn}
                  aria-label="Vergrössern"
                  title="Vergrössern"
                >
                  <Plus size={28} strokeWidth={2.75} />
                </button>
                <button
                  className="map-control-btn"
                  type="button"
                  onClick={handleZoomOut}
                  aria-label="Verkleinern"
                  title="Verkleinern"
                >
                  <Minus size={28} strokeWidth={2.75} />
                </button>
              </div>

              <div
                ref={mapElementRef}
                className="swiss-map-canvas"
                role="application"
                aria-label="Schweizer Karte mit Wanderwegen"
              />
              <span className="sr-only">
                Die Karte kann mit dem Finger oder mit der Maus verschoben werden.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}