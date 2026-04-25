"use client";

import React from 'react';

const NEWS_CACHE_KEY = 'seniornett-news-cache-v1';
const TEXT_SIZE_KEY = 'seniornett-text-size-v1';

const CAREGIVER_CONTACT = {
  name: 'Nina',
  phone: '079 555 12 34',
};

const FALLBACK_NEWS = [
  {
    id: 'fallback-1',
    title: 'SeniorNett zeigt Nachrichten ruhig und ohne Werbung.',
    summary: 'Sobald eine Verbindung besteht, laden wir aktuelle Meldungen von ausgewählten Schweizer Quellen. Ohne Internet bleibt die letzte Ausgabe lesbar.',
    source: 'SeniorNett',
    publishedAt: '',
    image: null,
  },
  {
    id: 'fallback-2',
    title: 'Wichtige Meldungen werden in grosser Schrift gesammelt.',
    summary: 'Die Nachrichtenansicht bleibt bewusst einfach: klare Überschriften, kurze Zusammenfassungen und kein hektischer Strom von Meldungen.',
    source: 'SeniorNett',
    publishedAt: '',
    image: null,
  },
];

const AppStateContext = React.createContext(null);

function readNewsCache() {
  try {
    const raw = window.localStorage.getItem(NEWS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeNewsCache(payload) {
  try {
    window.localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep the in-memory copy.
  }
}

function readTextSize() {
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_KEY);
    const parsed = raw ? Number(JSON.parse(raw)) : 1;
    return [0, 1, 2].includes(parsed) ? parsed : 1;
  } catch {
    return 1;
  }
}

function writeTextSize(value) {
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep the current in-memory value.
  }
}

export function AppProvider({ children, loadNewsAction }) {
  const [textSize, setTextSize] = React.useState(1);
  const [isOnline, setIsOnline] = React.useState(true);
  const [identity, setIdentity] = React.useState({
    loading: true,
    userName: 'Unbekannt',
    deviceId: 'unbekannt',
    vpnIp: '-',
    role: '-',
    source: 'loading',
  });
  const [news, setNews] = React.useState({
    loading: true,
    items: FALLBACK_NEWS,
    updatedAt: null,
    source: 'fallback',
    error: null,
  });

  React.useEffect(() => {
    const scale = [1, 1.2, 1.45][textSize] || 1;
    document.documentElement.style.setProperty('--type-scale', String(scale));
    document.body.classList.add('hc');
    writeTextSize(textSize);
  }, [textSize]);

  React.useEffect(() => {
    setTextSize(readTextSize());
    setIsOnline(window.navigator.onLine);

    const cachedNews = readNewsCache();
    if (cachedNews?.items?.length) {
      setNews({
        loading: false,
        items: cachedNews.items,
        updatedAt: cachedNews.updatedAt || null,
        source: 'cache',
        error: null,
      });
      return;
    }

    setNews((current) => ({
      ...current,
      loading: false,
    }));
  }, []);

  React.useEffect(() => {
    const applyFallback = () => {
      setIdentity({
        loading: false,
        userName: 'Unbekannt',
        deviceId: `port-${window.location.port || 'n/a'}`,
        vpnIp: '-',
        role: '-',
        source: 'fallback',
      });
    };

    const loadIdentity = async () => {
      try {
        const response = await fetch('/api/identity', { credentials: 'include' });
        if (!response.ok) {
          applyFallback();
          return;
        }

        const data = await response.json();
        setIdentity({
          loading: false,
          userName: data.user?.name || 'Unbekannt',
          deviceId: data.deviceId || 'unbekannt',
          vpnIp: data.vpnIp || '-',
          role: data.user?.role || '-',
          source: 'api',
        });
      } catch {
        applyFallback();
      }
    };

    loadIdentity();
  }, []);

  React.useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const refreshNews = React.useCallback(async () => {
    if (!window.navigator.onLine) {
      setNews((current) => ({
        ...current,
        loading: false,
        error: current.updatedAt ? null : 'offline',
      }));
      return;
    }

    setNews((current) => ({ ...current, loading: true, error: null }));

    try {
      const result = await loadNewsAction();

      if (!result?.items?.length) {
        throw new Error('Keine Nachrichten gefunden.');
      }

      const payload = {
        items: result.items,
        updatedAt: result.updatedAt || new Date().toISOString(),
      };

      writeNewsCache(payload);
      setNews({
        loading: false,
        items: payload.items,
        updatedAt: payload.updatedAt,
        source: 'live',
        error: null,
      });
    } catch {
      const cached = readNewsCache();
      setNews({
        loading: false,
        items: cached?.items?.length ? cached.items : FALLBACK_NEWS,
        updatedAt: cached?.updatedAt || null,
        source: cached?.items?.length ? 'cache' : 'fallback',
        error: 'unavailable',
      });
    }
  }, [loadNewsAction]);

  React.useEffect(() => {
    if (!isOnline) {
      setNews((current) => ({ ...current, loading: false }));
      return;
    }

    refreshNews();
  }, [isOnline, refreshNews]);

  const readAloud = React.useCallback(() => {
    const cue = document.createElement('div');
    cue.textContent = '🔊 Vorlesen …';
    cue.style.cssText = 'position:fixed;bottom:200px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:14px 22px;border-radius:999px;font-family:Atkinson Hyperlegible, Arial, sans-serif;font-weight:600;z-index:9999;font-size:18px;';
    document.body.appendChild(cue);
    window.setTimeout(() => cue.remove(), 1800);
  }, []);

  const value = React.useMemo(() => ({
    CAREGIVER_CONTACT,
    textSize,
    setTextSize,
    isOnline,
    identity,
    news,
    refreshNews,
    readAloud,
  }), [textSize, isOnline, identity, news, refreshNews, readAloud]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div className="offline-overlay" role="status" aria-live="assertive">
          <div className="offline-panel">
            <div className="offline-eyebrow">Verbindung unterbrochen</div>
            <h2>SeniorNett ist im Moment offline.</h2>
            <p>
              Keine Sorge. Die Seite verbindet sich automatisch wieder. Bereits geladene Inhalte bleiben sichtbar.
            </p>
            <div className="offline-actions">
              <a className="btn btn-accent" href={`tel:${CAREGIVER_CONTACT.phone.replace(/\s+/g, '')}`}>
                {CAREGIVER_CONTACT.name} anrufen: {CAREGIVER_CONTACT.phone}
              </a>
            </div>
          </div>
        </div>
      )}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = React.useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppProvider.');
  }

  return context;
}
