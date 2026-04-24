import React from 'react';
import { Icon } from './icons.jsx';

export function TopBar({ textSize, onTextSize, contrast, onContrast, onRead }) {
  const time = new Date();
  const dateStr = time.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = time.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="topbar">
      <div className="logo">
        <div className="logo-mark" aria-hidden />
        <span>SeniorNett</span>
        <span style={{ fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6, fontSize: 'var(--fs-sm)' }}>.ch</span>
      </div>

      <div style={{ marginLeft: 28 }} className="a11y">
        <div className="a11y-group" role="group" aria-label="Textgröße">
          {['A', 'A+', 'A++'].map((label, i) => (
            <button
              key={label}
              className={`a11y-btn ${textSize === i ? 'active' : ''}`}
              onClick={() => onTextSize(i)}
              style={{ fontSize: i === 0 ? 14 : i === 1 ? 17 : 20 }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="divider" />
        <button className={`a11y-btn ${contrast ? 'active' : ''}`} onClick={onContrast} aria-pressed={contrast}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18" fill="currentColor" />
            <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" />
          </svg>
          Kontrast
        </button>
        <button className="a11y-btn" onClick={onRead} title="Seite vorlesen">
          {Icon.speaker}
          Vorlesen
        </button>
      </div>

      <div className="spacer" />

      <div className="time">{dateStr} · {timeStr}</div>
    </div>
  );
}

export function Dock({ onHome, onAssistant, onHelp, screen }) {
  return (
    <div className="dock">
      <div className="dock-left">
        <button className={`dock-btn ${screen === 'home' ? 'primary' : ''}`} onClick={onHome}>
          {Icon.home}
          Startseite
        </button>
        <button className="dock-btn" onClick={onAssistant}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14,
          }}>L</span>
          Lotti fragen
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
        Privater Treffpunkt · nur verifizierte Mitglieder
      </div>
      <button className="dock-help" onClick={onHelp}>
        {Icon.help}
        Hilfe
      </button>
    </div>
  );
}

const SUGGESTIONS = [
  'Wie rufe ich meine Tochter an?',
  'Was bedeutet «AHV‑Rente»?',
  'Wetter in Luzern diese Woche',
  'Rezept für Zürcher Geschnetzeltes',
];

function mockAnswer(q) {
  const lower = q.toLowerCase();
  if (lower.includes('tochter') || lower.includes('anruf')) {
    return 'Tippen Sie auf der Startseite auf «Video & Anrufe», dann wählen Sie Ihre Tochter aus der Liste. Möchten Sie, dass ich es zusammen mit Ihnen durchgehe?';
  }
  if (lower.includes('ahv') || lower.includes('rente')) {
    return 'Die AHV (Alters- und Hinterlassenenversicherung) ist die staatliche Rente in der Schweiz. Wenn Sie möchten, öffne ich Grokipedia mit einer einfachen Erklärung.';
  }
  if (lower.includes('wetter')) {
    return 'In Luzern wird es diese Woche mild: 14–19 °C, teils sonnig, am Donnerstag Regen. Soll ich eine Erinnerung für den Regentag setzen?';
  }
  if (lower.includes('rezept') || lower.includes('geschnetzel')) {
    return 'Zürcher Geschnetzeltes: Kalbfleisch in Streifen, mit Schalotten und Champignons anbraten, mit Weisswein und Rahm ablöschen. Dazu Rösti. Soll ich das Rezept in grosser Schrift öffnen?';
  }
  return 'Gerne! Ich suche das für Sie heraus. Sie können auch auf der Startseite direkt eine App öffnen.';
}

export function Assistant({ open, onClose, initialPrompt }) {
  const [messages, setMessages] = React.useState([
    { from: 'bot', text: 'Grüezi! Ich bin Lotti, Ihr Assistent. Ich helfe Ihnen, Dinge zu finden oder zu erklären. Was möchten Sie heute tun?' },
  ]);
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (open && initialPrompt) {
      setMessages([
        { from: 'bot', text: 'Grüezi! Ich bin Lotti, Ihr Assistent.' },
        { from: 'user', text: initialPrompt },
        { from: 'bot', text: 'Einen Moment, ich schaue das gerne für Sie an …' },
      ]);
    }
  }, [open, initialPrompt]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = (text) => {
    if (!text.trim()) return;
    const userMsg = { from: 'user', text };
    setMessages(m => [...m, userMsg, { from: 'bot', text: 'Einen Moment …', pending: true }]);
    setDraft('');
    setTimeout(() => {
      setMessages(m => {
        const withoutPending = m.filter(x => !x.pending);
        return [...withoutPending, { from: 'bot', text: mockAnswer(text) }];
      });
    }, 900);
  };

  if (!open) return null;
  return (
    <div className="assistant-overlay" onClick={onClose}>
      <div className="assistant-panel" onClick={e => e.stopPropagation()}>
        <div className="assistant-head">
          <div className="avatar">L</div>
          <div>
            <div className="name">Lotti</div>
            <div className="role">Ihr persönlicher Assistent</div>
          </div>
          <button className="close-x" onClick={onClose} aria-label="Schliessen">×</button>
        </div>
        <div className="assistant-messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>{m.text}</div>
          ))}
        </div>
        <div className="chip-row">
          {SUGGESTIONS.map(s => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
        <div className="assistant-foot">
          <input
            className="field"
            placeholder="Schreiben Sie Ihre Frage …"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(draft)}
          />
          <button className="btn btn-primary" onClick={() => send(draft)} style={{ height: 64, width: 64, padding: 0 }}>
            {Icon.send}
          </button>
        </div>
      </div>
    </div>
  );
}
