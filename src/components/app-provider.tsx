// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { createTranslator, getLocaleTag, normalizeLanguage } from '@/lib/i18n';
import { readJsonFromStorage, writeJsonToStorage } from '@/lib/shared/client-storage';
import styles from "./app-provider.module.css";

const NEWS_CACHE_KEY = 'seniornett-news-cache-v1';
const TEXT_SIZE_KEY = 'seniornett-text-size-v1';

const CAREGIVER_CONTACT = {
  name: 'Nina',
  phone: '079 555 12 34',
};

type AppIdentity = {
  loading: boolean;
  userName: string;
  deviceId: string;
  vpnIp: string;
  role: string;
  language: ReturnType<typeof normalizeLanguage>;
  source: string;
};

type AppStateValue = {
  CAREGIVER_CONTACT: typeof CAREGIVER_CONTACT;
  textSize: number;
  setTextSize: React.Dispatch<React.SetStateAction<number>>;
  isOnline: boolean;
  identity: AppIdentity;
  locale: ReturnType<typeof normalizeLanguage>;
  localeTag: string;
  t: ReturnType<typeof createTranslator>;
  news: {
    loading: boolean;
    items: Array<{
      id: string;
      title: string;
      summary: string;
      source: string;
      publishedAt: string;
      image: string | null;
    }>;
    updatedAt: string | null;
    source: string;
    error: string | null;
  };
  refreshNews: () => Promise<void>;
  readAloud: () => void;
};

const AppStateContext = React.createContext<AppStateValue | null>(null);

function readNewsCache() {
  return readJsonFromStorage(NEWS_CACHE_KEY, null);
}

function writeNewsCache(payload) {
  writeJsonToStorage(NEWS_CACHE_KEY, payload);
}

function readTextSize() {
  const parsed = Number(readJsonFromStorage(TEXT_SIZE_KEY, 1));
  return [0, 1, 2].includes(parsed) ? parsed : 1;
}

function writeTextSize(value) {
  writeJsonToStorage(TEXT_SIZE_KEY, value);
}

function buildFallbackNews(t) {
  return [
    {
      id: 'fallback-1',
      title: t('news.fallback.one.title'),
      summary: t('news.fallback.one.summary'),
      source: 'SeniorNett',
      publishedAt: '',
      image: null,
    },
    {
      id: 'fallback-2',
      title: t('news.fallback.two.title'),
      summary: t('news.fallback.two.summary'),
      source: 'SeniorNett',
      publishedAt: '',
      image: null,
    },
  ];
}

export function AppProvider({ children, loadNewsAction, initialIdentity }) {
  const [textSize, setTextSize] = React.useState(1);
  const [isOnline, setIsOnline] = React.useState(true);
  const [identity, setIdentity] = React.useState({
    loading: !initialIdentity,
    userName: initialIdentity?.userName || createTranslator(initialIdentity?.language)("topbar.userUnknown"),
    deviceId: initialIdentity?.deviceId || 'unbekannt',
    vpnIp: initialIdentity?.vpnIp || '-',
    role: initialIdentity?.role || '-',
    language: normalizeLanguage(initialIdentity?.language),
    source: initialIdentity ? 'server' : 'loading',
  });
  const [locale, setLocale] = React.useState(normalizeLanguage(initialIdentity?.language));
  const [news, setNews] = React.useState({
    loading: true,
    items: buildFallbackNews(createTranslator(initialIdentity?.language)),
    updatedAt: null,
    source: 'fallback',
    error: null,
  });

  const t = React.useMemo(() => createTranslator(locale), [locale]);
  const localeTag = React.useMemo(() => getLocaleTag(locale), [locale]);

  React.useEffect(() => {
    const scale = [1, 1.2, 1.45][textSize] || 1;
    document.documentElement.style.setProperty('--type-scale', String(scale));
    document.body.classList.add('hc');
    writeTextSize(textSize);
  }, [textSize]);

  React.useEffect(() => {
    document.documentElement.lang = localeTag;
  }, [localeTag]);

  React.useEffect(() => {
    // Keep localized fallback news in sync when the locale changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNews((current) => ({
      ...current,
      items: current.source === 'fallback' || !current.items.length ? buildFallbackNews(t) : current.items,
    }));
  }, [t]);

  React.useEffect(() => {
    // We intentionally sync a few client-only values from browser APIs on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [t]);

  React.useEffect(() => {
    const applyFallback = () => {
      const fallbackLanguage = 'de';
      const fallbackT = createTranslator(fallbackLanguage);
      setIdentity({
        loading: false,
        userName: fallbackT('topbar.userUnknown'),
        deviceId: `port-${window.location.port || 'n/a'}`,
        vpnIp: '-',
        role: '-',
        language: fallbackLanguage,
        source: 'fallback',
      });
      setLocale(fallbackLanguage);
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
          userName: data.user?.name || t('topbar.userUnknown'),
          deviceId: data.deviceId || 'unbekannt',
          vpnIp: data.vpnIp || '-',
          role: data.user?.role || '-',
          language: normalizeLanguage(data.user?.language),
          source: 'api',
        });
        setLocale(normalizeLanguage(data.user?.language));
      } catch {
        applyFallback();
      }
    };

    loadIdentity();
  }, [t]);

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
        items: cached?.items?.length ? cached.items : buildFallbackNews(t),
        updatedAt: cached?.updatedAt || null,
        source: cached?.items?.length ? 'cache' : 'fallback',
        error: 'unavailable',
      });
    }
  }, [loadNewsAction, t]);

  React.useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNews((current) => ({ ...current, loading: false }));
      return;
    }

    refreshNews();
  }, [isOnline, refreshNews]);

  const readAloud = React.useCallback(() => {
    const cue = document.createElement('div');
    cue.textContent = `🔊 ${t('common.readAloudCue')}`;
    cue.style.cssText = 'position:fixed;bottom:200px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:14px 22px;border-radius:999px;font-family:Atkinson Hyperlegible, Arial, sans-serif;font-weight:600;z-index:9999;font-size:18px;';
    document.body.appendChild(cue);
    window.setTimeout(() => cue.remove(), 1800);
  }, [t]);

  const value = React.useMemo(() => ({
    CAREGIVER_CONTACT,
    textSize,
    setTextSize,
    isOnline,
    identity,
    locale,
    localeTag,
    t,
    news,
    refreshNews,
    readAloud,
  }), [textSize, isOnline, identity, locale, localeTag, t, news, refreshNews, readAloud]);

  return (
    <AppStateContext.Provider value={value}>
      <div className={styles.scope}>
        {children}
        {!isOnline && (
          <div className="offline-overlay" role="status" aria-live="assertive">
            <div className="offline-panel">
              <div className="offline-eyebrow">{t('offline.eyebrow')}</div>
              <h2>{t('offline.title')}</h2>
              <p>{t('offline.body')}</p>
              <div className="offline-actions">
                <a className="btn btn-accent" href={`tel:${CAREGIVER_CONTACT.phone.replace(/\s+/g, '')}`}>
                  {t('offline.call', { name: CAREGIVER_CONTACT.name, phone: CAREGIVER_CONTACT.phone })}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateValue {
  const context = React.useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppProvider.');
  }

  return context;
}
