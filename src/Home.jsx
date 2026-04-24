import React from 'react';
import { Icon } from './icons.jsx';

export const APPS = [
  { id: 'grokipedia', icon: Icon.book, label: 'Grokipedia', sub: 'Einfach erklärtes Wissen' },
  { id: 'social', icon: Icon.people, label: 'Nachbarn', sub: 'Ihr privates Netzwerk', badge: 3 },
  { id: 'travel', icon: Icon.ship, label: 'Ferien', sub: 'Reisen mit Agentin Lotti' },
  { id: 'market', icon: Icon.cart, label: 'Marktplatz', sub: 'Kaufen & Verkaufen' },
  { id: 'dating', icon: Icon.heart, label: 'Begleitung', sub: 'Menschen kennenlernen' },
  { id: 'video', icon: Icon.video, label: 'Video & Anrufe', sub: 'Familie auf dem Bildschirm', badge: 1 },
  { id: 'health', icon: Icon.health, label: 'Gesundheit', sub: 'Termine & Erinnerungen' },
  { id: 'news', icon: Icon.news, label: 'Nachrichten', sub: 'Ruhig & sorgfältig' },
  { id: 'games', icon: Icon.puzzle, label: 'Spiele', sub: 'Gedächtnis & Denksport' },
];

export function Home({ onOpen, layout, onLayoutChange, onAskLotti }) {
  return (
    <div className="home">
      <div className="home-greeting">
        <div>
          <h1>Grüezi, Heidi.</h1>
          <div className="date">{new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="weather">
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Luzern</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 28, height: 28, display: 'inline-flex' }}>{Icon.sun}</span>
            <b>17°</b>
          </div>
          <div style={{ color: 'var(--ink-3)' }}>Heiter</div>
        </div>
      </div>

      <div>
        <div className="section-label">
          <span>Meine Apps</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--ink-3)', letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>
              Tippen Sie, um zu öffnen
            </span>
            <div className="a11y-group" role="group" aria-label="Darstellung">
              <button
                className={`a11y-btn ${layout === 'grid' ? 'active' : ''}`}
                onClick={() => onLayoutChange('grid')}
              >
                Raster
              </button>
              <button
                className={`a11y-btn ${layout === 'list' ? 'active' : ''}`}
                onClick={() => onLayoutChange('list')}
              >
                Liste
              </button>
            </div>
          </div>
        </div>
        <div className={`tiles ${layout === 'list' ? 'list' : ''}`}>
          {APPS.map(app => (
            <button key={app.id} className="tile" onClick={() => onOpen(app.id)}>
              {layout === 'list' ? (
                <>
                  <div className="icon">{app.icon}</div>
                  <div className="tile-stack">
                    <div className="tile-label">{app.label}</div>
                    <div className="tile-sub">{app.sub}</div>
                  </div>
                  {app.badge && <div className="tile-badge">{app.badge}</div>}
                  <div className="arrow">›</div>
                </>
              ) : (
                <>
                  <div className="icon">{app.icon}</div>
                  <div>
                    <div className="tile-label">{app.label}</div>
                    <div className="tile-sub">{app.sub}</div>
                  </div>
                  {app.badge && <div className="tile-badge">{app.badge}</div>}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div className="card" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, fontWeight: 700 }}>
            Agentin Lotti
          </div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginTop: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Ich kann für Sie Ferien planen, Begriffe erklären oder Freunde finden.
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-accent" onClick={() => onAskLotti('Ich möchte Ferien planen.')}>
              Ferien planen
            </button>
            <button className="btn" style={{ background: 'transparent', color: 'var(--paper)', borderColor: 'var(--paper)' }} onClick={() => onAskLotti()}>
              Etwas anderes fragen
            </button>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>
            Heute
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, border: '2px solid var(--ink)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon.calendar}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Hausarzt Dr. Meier</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>14:30 · Apothekerstr. 4</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, border: '2px solid var(--ink)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon.people}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Anna hat geschrieben</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>«Kaffee am Samstag?»</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
