"use client";

import React from 'react';
import Link from 'next/link';
import { Volume2 } from 'lucide-react';
import { useAppState } from './app-provider.jsx';

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const time = new Date(value);
  const dateStr = time.toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = time.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateStr} · ${timeStr}`;
}

export function TopBar() {
  const { textSize, setTextSize, readAloud, identity } = useAppState();
  const [now, setNow] = React.useState(null);

  React.useEffect(() => {
    const updateNow = () => setNow(new Date().toISOString());

    updateNow();
    const intervalId = window.setInterval(updateNow, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="topbar">
      <Link className="logo logo-btn" href="/" aria-label="Zur Startseite">
        <div className="logo-mark" aria-hidden />
        <div className="logo-copy">
          <div className="logo-brand">
            <span>SeniorNett</span>
            <span style={{ fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6, fontSize: 'var(--fs-sm)' }}>.ch</span>
          </div>
          <div className="logo-home-label">Zur Startseite</div>
        </div>
      </Link>

      <div className="a11y">
        <div className="a11y-group" role="group" aria-label="Textgröße">
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
        <button className="a11y-btn" onClick={readAloud} title="Seite vorlesen">
          <Volume2 size={18} strokeWidth={2.25} />
          Vorlesen
        </button>
      </div>

      <div className="spacer" />

      <div className="whoami-chip" aria-live="polite">
        <div className="whoami-main">
          {identity?.loading ? 'Wird geladen ...' : `${identity?.userName || 'Unbekannt'}`}
        </div>
      </div>

      <div className="time" aria-live="polite">{formatDateTime(now)}</div>
    </div>
  );
}
