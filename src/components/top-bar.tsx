// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import Link from 'next/link';
import { Volume2 } from 'lucide-react';
import { useAppState } from './app-provider';

function formatDateTime(value, localeTag, separator) {
  if (!value) {
    return '';
  }

  const time = new Date(value);
  const dateStr = time.toLocaleDateString(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = time.toLocaleTimeString(localeTag, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateStr}${separator}${timeStr}`;
}

export function TopBar() {
  const { textSize, setTextSize, readAloud, identity, t, localeTag } = useAppState();
  const [now, setNow] = React.useState(null);

  React.useEffect(() => {
    const updateNow = () => setNow(new Date().toISOString());

    updateNow();
    const intervalId = window.setInterval(updateNow, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="topbar">
      <Link className="logo logo-btn" href="/" aria-label={t('common.home')}>
        {t('common.home')}
      </Link>

      <div className="a11y">
        <div className="a11y-group" role="group" aria-label={t('common.textSize')}>
          {['A', 'A+', 'A++'].map((label, i) => (
            <button
              key={label}
              className={`a11y-btn ${textSize === i ? 'active' : ''}`}
              onClick={() => setTextSize(i)}
              style={{ fontSize: i === 0 ? 14 : i === 1 ? 17 : 20 }}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="a11y-btn" onClick={readAloud} title={t('common.readAloud')}>
          <Volume2 size={18} strokeWidth={2.25} />
          {t('common.readAloud')}
        </button>
      </div>

      <div className="spacer" />

      <div className="whoami-chip" aria-live="polite">
        <div className="whoami-main">
          {identity?.loading ? t('topbar.userLoading') : `${identity?.userName || t('topbar.userUnknown')}`}
        </div>
      </div>

      <div className="time" aria-live="polite">{formatDateTime(now, localeTag, t('topbar.dateTimeSeparator'))}</div>
    </div>
  );
}
