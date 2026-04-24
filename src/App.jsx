import React from 'react';
import { TopBar, Dock, Assistant } from './Shell.jsx';
import { Home, APPS } from './Home.jsx';
import { HolidayApp, GrokipediaApp, SocialApp, StubApp } from './Apps.jsx';

const SCREEN_LABELS = {
  home: '00 Home',
  grokipedia: '01 Grokipedia',
  social: '02 Nachbarn',
  travel: '03 Ferien',
  market: '04 Marktplatz',
  dating: '05 Begleitung',
  video: '06 Video & Anrufe',
  health: '07 Gesundheit',
  news: '08 Nachrichten',
  games: '09 Spiele',
};

const STUB_DESCRIPTIONS = {
  market: 'Lokale Anzeigen von verifizierten Nachbarn. Möbel, Bücher, Gartenwerkzeug, Hausrat. Abholung oder Lieferung durch das SeniorNet‑Velo.',
  dating: 'Menschen kennenlernen — für Gespräche, Spaziergänge oder Kaffee. Alle Mitglieder sind persönlich verifiziert.',
  video: 'Einfache Video‑Anrufe mit Familie. Grosse Knöpfe, automatische Annahme nach drei Ringen. Kein Einrichten nötig.',
  health: 'Termine, Medikamenten‑Erinnerungen und direkte Verbindung zu Ihrem Hausarzt.',
  news: 'Wichtige Nachrichten, kurz und klar. Keine Reizüberflutung, keine Werbung.',
  games: 'Memory, Jass, Sudoku und Wortspiele — allein oder mit anderen Mitgliedern.',
};

export default function App() {
  const [layout, setLayout] = React.useState('grid');
  const [textSize, setTextSize] = React.useState(1);
  const [contrast, setContrast] = React.useState(false);

  const [screen, setScreen] = React.useState('home');
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [assistantPrompt, setAssistantPrompt] = React.useState(null);

  React.useEffect(() => {
    const scale = [1, 1.2, 1.45][textSize] || 1;
    document.documentElement.style.setProperty('--type-scale', String(scale));
    document.body.classList.toggle('hc', !!contrast);
  }, [textSize, contrast]);

  React.useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = Math.min(w / (1366 + 48), h / (1024 + 48), 1);
      document.documentElement.style.setProperty('--tablet-scale', String(s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const openApp = (id) => setScreen(id);
  const goHome = () => setScreen('home');

  const askLotti = (prompt) => {
    setAssistantPrompt(prompt || null);
    setAssistantOpen(true);
  };

  const readAloud = () => {
    const cue = document.createElement('div');
    cue.textContent = '🔊 Vorlesen …';
    cue.style.cssText = 'position:fixed;bottom:200px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:14px 22px;border-radius:999px;font-family:Inter,sans-serif;font-weight:600;z-index:9999;font-size:18px;';
    document.body.appendChild(cue);
    setTimeout(() => cue.remove(), 1800);
  };

  let currentScreen;
  if (screen === 'home') {
    currentScreen = (
      <Home
        onOpen={openApp}
        layout={layout}
        onLayoutChange={setLayout}
        onAskLotti={askLotti}
      />
    );
  } else if (screen === 'travel') {
    currentScreen = <HolidayApp onBack={goHome} onAskLotti={askLotti} />;
  } else if (screen === 'grokipedia') {
    currentScreen = <GrokipediaApp onBack={goHome} onRead={readAloud} />;
  } else if (screen === 'social') {
    currentScreen = <SocialApp onBack={goHome} />;
  } else {
    const a = APPS.find(x => x.id === screen);
    currentScreen = (
      <StubApp
        onBack={goHome}
        title={a.label}
        icon={a.icon}
        description={STUB_DESCRIPTIONS[screen]}
      />
    );
  }

  return (
    <div className="tablet-screen">
      <TopBar
        textSize={textSize}
        onTextSize={setTextSize}
        contrast={contrast}
        onContrast={() => setContrast(v => !v)}
        onRead={readAloud}
      />
      <div className="content" data-screen-label={SCREEN_LABELS[screen] || screen}>
        {currentScreen}
      </div>
      <Dock
        screen={screen}
        onHome={goHome}
        onAssistant={() => askLotti()}
        onHelp={() => askLotti('Ich brauche Hilfe mit dieser Seite.')}
      />
      <Assistant
        open={assistantOpen}
        onClose={() => { setAssistantOpen(false); setAssistantPrompt(null); }}
        initialPrompt={assistantPrompt}
      />
      {!assistantOpen && (
        <button className="assistant-fab" onClick={() => askLotti()}>
          <div className="dot">L</div>
          Lotti
        </button>
      )}
    </div>
  );
}
