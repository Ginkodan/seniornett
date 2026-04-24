import React from 'react';
import { Icon } from './icons.jsx';

export function HolidayApp({ onBack, onAskLotti }) {
  const [step, setStep] = React.useState(0);
  const [budget, setBudget] = React.useState(3000);
  const [duration, setDuration] = React.useState(7);
  const [type, setType] = React.useState('Kreuzfahrt');
  const [mobility, setMobility] = React.useState('Mittel');

  const types = ['Kreuzfahrt', 'Wellness', 'Städtereise', 'Berge'];
  const mobilities = ['Gut', 'Mittel', 'Langsam'];

  const results = [
    { id: 1, title: 'Rhein‑Kreuzfahrt Basel → Amsterdam', len: '7 Tage', price: 2890, tag: 'Empfohlen',
      detail: 'Kleines Schiff, 90 Gäste. Deutschsprachige Reiseleitung. Barrierearm.', img: 'SCHIFF · RHEIN' },
    { id: 2, title: 'Bad Ragaz · Wellness & Spa', len: '5 Tage', price: 1780, tag: 'Ruhig',
      detail: 'Thermalbad, tägliche Spaziergänge mit Gruppe, Halbpension.', img: 'SPA · GR' },
    { id: 3, title: 'Engadin · Wanderferien leicht', len: '6 Tage', price: 1490, tag: 'Aktiv',
      detail: 'Flache Wege am See, Gepäcktransport inklusive, Hotel in Sils.', img: 'ENGADIN · GR' },
  ];

  const Header = () => (
    <div className="app-header">
      <button className="back-btn" onClick={onBack}>{Icon.back} Zurück</button>
      <h1 className="app-title">Ferien planen mit Lotti</h1>
      <div className="spacer" />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid var(--ink)',
              background: i <= step ? 'var(--ink)' : 'transparent',
              color: i <= step ? 'var(--paper)' : 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 'var(--fs-sm)',
            }}>{i + 1}</div>
            {i < 2 && <div style={{ width: 28, height: 2, background: 'var(--ink)', opacity: i < step ? 1 : 0.2 }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        {step === 0 && (
          <div style={{ padding: '40px 56px', maxWidth: 900 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--ink)', color: 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--fs-lg)', fontWeight: 800, flexShrink: 0,
              }}>L</div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>
                  Lotti fragt
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 8 }}>
                  Wohin soll die Reise gehen?
                </div>
                <div style={{ color: 'var(--ink-3)', marginTop: 8 }}>
                  Ich stelle Ihnen drei kurze Fragen und suche dann passende Angebote heraus.
                </div>
              </div>
            </div>

            <div className="col" style={{ gap: 28 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 12 }}><span>Art der Ferien</span></div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {types.map(t => (
                    <button key={t} className={`btn btn-lg ${type === t ? 'btn-primary' : ''}`} onClick={() => setType(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-label" style={{ marginBottom: 12 }}><span>Dauer</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <button className="btn btn-lg" onClick={() => setDuration(Math.max(3, duration - 1))} style={{ width: 72 }}>−</button>
                  <div style={{ fontSize: 'var(--fs-xxl)', fontWeight: 800, minWidth: 140, textAlign: 'center', letterSpacing: '-0.03em' }}>
                    {duration}<span style={{ fontSize: 'var(--fs-md)', color: 'var(--ink-3)', marginLeft: 8, fontWeight: 500 }}>Tage</span>
                  </div>
                  <button className="btn btn-lg" onClick={() => setDuration(Math.min(21, duration + 1))} style={{ width: 72 }}>+</button>
                </div>
              </div>

              <div>
                <div className="section-label" style={{ marginBottom: 12 }}><span>Budget</span></div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xxl)', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span>CHF {budget.toLocaleString('de-CH')}</span>
                    <span style={{ fontSize: 'var(--fs-md)', color: 'var(--ink-3)', fontWeight: 500 }}>pro Person</span>
                  </div>
                  <input type="range" min="500" max="8000" step="100" value={budget}
                    onChange={e => setBudget(+e.target.value)}
                    style={{ width: '100%', marginTop: 20, height: 44, accentColor: '#1A1A1A' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-3)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>
                    <span>CHF 500</span><span>CHF 8'000</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="section-label" style={{ marginBottom: 12 }}><span>Mobilität</span></div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {mobilities.map(m => (
                    <button key={m} className={`btn btn-lg ${mobility === m ? 'btn-primary' : ''}`} onClick={() => setMobility(m)}>
                      {m === 'Gut' ? 'Gut zu Fuss' : m === 'Mittel' ? 'Mittel' : 'Langsam / mit Gehhilfe'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 40, display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-lg btn-accent" onClick={() => setStep(1)}>Vorschläge suchen →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ padding: '40px 56px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>
                  Lotti hat gefunden
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>
                  3 Reisen für Sie
                </div>
                <div style={{ color: 'var(--ink-3)', marginTop: 6 }}>
                  {type} · {duration} Tage · bis CHF {budget.toLocaleString('de-CH')} · Mobilität {mobility.toLowerCase()}
                </div>
              </div>
              <button className="btn" onClick={() => setStep(0)}>Angaben ändern</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {results.map(r => (
                <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="placeholder-img" style={{ height: 180 }}>{r.img}</div>
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
                    <div style={{
                      alignSelf: 'flex-start',
                      fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em',
                      padding: '4px 10px', border: '1px solid var(--ink)', borderRadius: 4, fontWeight: 700,
                      background: r.tag === 'Empfohlen' ? 'var(--ink)' : 'transparent',
                      color: r.tag === 'Empfohlen' ? 'var(--paper)' : 'var(--ink)',
                    }}>{r.tag}</div>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{r.title}</div>
                    <div style={{ color: 'var(--ink-3)' }}>{r.detail}</div>
                    <div className="hr" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>{r.len}</div>
                      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, letterSpacing: '-0.02em' }}>CHF {r.price.toLocaleString('de-CH')}</div>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setStep(2)}>Ansehen & buchen</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 32, background: 'var(--paper-2)',
              border: '2px dashed var(--ink)', borderRadius: 8,
              padding: 24, display: 'flex', gap: 20, alignItems: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--ink)', color: 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, flexShrink: 0,
              }}>L</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>Soll ich für Sie anrufen?</div>
                <div style={{ color: 'var(--ink-3)' }}>
                  Ich kann die Reiseagentur direkt kontaktieren und Ihnen alles per Post senden.
                </div>
              </div>
              <button className="btn" onClick={() => onAskLotti('Bitte ruf die Reiseagentur an.')}>Mit Lotti sprechen</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '40px 56px', maxWidth: 900 }}>
            <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>
              Fast fertig
            </div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4, marginBottom: 28 }}>
              Rhein‑Kreuzfahrt Basel → Amsterdam
            </div>

            <div className="placeholder-img" style={{ height: 240, marginBottom: 24 }}>SCHIFF · RHEIN · PANORAMA</div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
              <div>
                <div className="section-label"><span>Was inbegriffen ist</span></div>
                <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {['7 Nächte Vollpension an Bord', 'Deutschsprachige Reiseleitung', 'Barrierearme Kabine, Lift an Bord', 'Tagesausflüge in Strassburg, Köln, Amsterdam', 'An‑ und Abreise mit SBB 1. Klasse'].map(x => (
                    <li key={x} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ width: 28, height: 28, border: '2px solid var(--ink)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon.check}</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>Zusammenfassung</div>
                <div style={{ fontSize: 'var(--fs-xxl)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>CHF 2'890</div>
                <div style={{ color: 'var(--ink-3)', marginBottom: 16 }}>pro Person, alles inklusive</div>
                <div className="hr" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Abreise</span><b>14. Juni 2026</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Rückkehr</span><b>21. Juni 2026</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kabine</span><b>Einzel, Deck 2</b></div>
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }}>Unverbindlich anfragen</button>
                <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setStep(1)}>Zurück zur Auswahl</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function GrokipediaApp({ onBack, onRead }) {
  const [q, setQ] = React.useState('Matterhorn');
  return (
    <div className="app">
      <div className="app-header">
        <button className="back-btn" onClick={onBack}>{Icon.back} Zurück</button>
        <h1 className="app-title">Grokipedia</h1>
        <div className="spacer" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative', width: 420 }}>
          <span style={{ position: 'absolute', left: 16, width: 22, height: 22 }}>{Icon.search}</span>
          <input className="field" style={{ paddingLeft: 48 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Begriff suchen …" />
        </div>
      </div>
      <div className="app-body">
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '100%' }}>
          <aside style={{ borderRight: '1px solid var(--ink)', padding: '28px 24px', background: 'var(--paper-2)' }}>
            <div className="section-label"><span>Ähnliche Themen</span></div>
            {['Schweizer Alpen', 'Zermatt', 'Erstbesteigung 1865', 'Edward Whymper', 'Bergsteigen heute'].map(s => (
              <button key={s} className="btn" style={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                marginBottom: 8,
                height: 'auto',
                minHeight: 52,
                padding: '12px 16px',
                lineHeight: 1.3,
                whiteSpace: 'normal',
              }}>{s}</button>
            ))}
          </aside>
          <article style={{ padding: '40px 56px', maxWidth: 820 }}>
            <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>
              Berg · Wallis
            </div>
            <h1 style={{ fontSize: 'var(--fs-xxl)', fontWeight: 800, letterSpacing: '-0.03em', margin: '8px 0 20px', lineHeight: 1 }}>Matterhorn</h1>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button className="btn" onClick={onRead}>{Icon.speaker} Vorlesen</button>
              <button className="btn">A Einfache Sprache</button>
              <button className="btn">Bilder anzeigen</button>
            </div>

            <div className="placeholder-img" style={{ height: 260, marginBottom: 24 }}>BERGFOTO · MATTERHORN</div>

            <p style={{ fontSize: 'var(--fs-md)', lineHeight: 1.6, marginTop: 0 }}>
              Das <b>Matterhorn</b> ist ein berühmter Berg in den Schweizer Alpen. Es steht im Kanton Wallis, in der Nähe des Dorfs <b>Zermatt</b>. Der Berg ist <b>4'478 Meter</b> hoch und hat eine ganz besondere, fast dreieckige Form.
            </p>
            <p style={{ fontSize: 'var(--fs-md)', lineHeight: 1.6 }}>
              Weil diese Form so auffällig ist, erkennt man das Matterhorn auf vielen Fotos und auf der Toblerone‑Verpackung. Zum ersten Mal wurde der Gipfel im Jahr <b>1865</b> bestiegen.
            </p>

            <div style={{
              background: 'var(--paper-2)',
              border: '2px solid var(--ink)',
              borderRadius: 8, padding: 24, marginTop: 24,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>Höhe</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>4'478 m</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>Kanton</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>Wallis</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>Erstbesteigung</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>14. Juli 1865</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)', fontWeight: 700 }}>Nächstes Dorf</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>Zermatt</div>
              </div>
            </div>

            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, letterSpacing: '-0.02em', marginTop: 36 }}>Warum ist es so bekannt?</h2>
            <p style={{ fontSize: 'var(--fs-md)', lineHeight: 1.6 }}>
              Das Matterhorn sieht aus wie ein riesiger <b>Zahn</b>, der in den Himmel zeigt. Diese Form gibt es weltweit nur selten. Viele Touristen kommen nach Zermatt, um den Berg zu sehen, mit der Gornergratbahn zu fahren oder Fotos zu machen.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

export function SocialApp({ onBack }) {
  const [posts] = React.useState([
    { id: 1, name: 'Anna Roth', age: 68, city: 'Luzern', time: 'vor 2 Std.',
      text: 'Heute am See spaziert — die Alpen sind so klar, man sieht bis zum Pilatus. Wer kommt Samstag mit in den Rosengarten?',
      img: 'SEE · PILATUS', likes: 12, comments: 4 },
    { id: 2, name: 'Peter Grüninger', age: 74, city: 'Bern', time: 'vor 4 Std.',
      text: 'Mein Enkel hat mir gezeigt, wie man hier schreibt. Grüezi mitenand!',
      likes: 24, comments: 9 },
    { id: 3, name: 'Margrit Keller', age: 71, city: 'Zürich', time: 'gestern',
      text: 'Habe die Zwetschgenwähe von meiner Grossmutter nachgebacken. Rezept teile ich gerne in Grokipedia.',
      img: 'ZWETSCHGENWÄHE', likes: 31, comments: 11 },
  ]);

  return (
    <div className="app">
      <div className="app-header">
        <button className="back-btn" onClick={onBack}>{Icon.back} Zurück</button>
        <h1 className="app-title">Nachbarn</h1>
        <div className="spacer" />
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
          <b style={{ color: 'var(--ink)' }}>128</b> verifizierte Mitglieder in Ihrer Nähe
        </div>
      </div>
      <div className="app-body">
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 0' }}>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '2px solid var(--ink)',
                background: 'var(--paper-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, flexShrink: 0,
              }}>HM</div>
              <textarea className="field" placeholder="Was möchten Sie Ihren Nachbarn erzählen, Heidi?" style={{ minHeight: 80 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ height: 48 }}>Foto hinzufügen</button>
                <button className="btn" style={{ height: 48 }}>Ort angeben</button>
              </div>
              <button className="btn btn-primary" style={{ height: 48 }}>Veröffentlichen</button>
            </div>
          </div>

          {posts.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  border: '2px solid var(--ink)',
                  background: 'var(--paper-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700,
                }}>{p.name.split(' ').map(s => s[0]).join('')}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{p.name}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>{p.age} · {p.city} · {p.time}</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.5 }}>{p.text}</p>
              {p.img && <div className="placeholder-img" style={{ height: 220, marginTop: 14, borderRadius: 4 }}>{p.img}</div>}
              <div className="hr" />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" style={{ height: 48 }}>♡ Gefällt mir · {p.likes}</button>
                <button className="btn" style={{ height: 48 }}>Kommentieren · {p.comments}</button>
                <button className="btn" style={{ height: 48, marginLeft: 'auto' }}>{Icon.speaker} Vorlesen</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StubApp({ onBack, title, description, icon }) {
  return (
    <div className="app">
      <div className="app-header">
        <button className="back-btn" onClick={onBack}>{Icon.back} Zurück</button>
        <h1 className="app-title">{title}</h1>
      </div>
      <div className="app-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 520, padding: 40 }}>
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            border: '3px solid var(--ink)', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--paper-2)',
          }}>
            <div style={{ width: 60, height: 60 }}>{icon}</div>
          </div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{title}</h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-md)', lineHeight: 1.5 }}>{description}</p>
          <div style={{ marginTop: 24, display: 'inline-block', padding: '10px 18px', border: '2px dashed var(--ink)', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 'var(--fs-sm)' }}>
            SKIZZE · DETAILLIERT AUSBAUEN
          </div>
        </div>
      </div>
    </div>
  );
}
