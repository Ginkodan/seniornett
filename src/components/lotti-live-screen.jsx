"use client";

import React from 'react';

export function LottiLiveScreen({ askLottiAction }) {
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, pending]);

  const submitQuestion = async () => {
    const text = draft.trim();
    if (!text || pending) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setPending(true);

    try {
      const history = messages.map(({ role, text }) => ({ role, text }));
      const result = await askLottiAction(text, history);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result?.text || 'Im Moment konnte ich keine Antwort formulieren.',
          source: result?.source || 'fallback',
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Im Moment klappt die Verbindung nicht ganz. Versuch es bitte noch einmal.',
          source: 'fallback',
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">Frag Lotti</h1>
      </div>

      <div className="app-body">
        <div className="lotti-shell">
          <div className="lotti-card">
            <div className="lotti-messages" ref={listRef}>
              {!messages.length && !pending && (
                <div className="lotti-empty-state">
                  Ihre Unterhaltung erscheint hier.
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`lotti-message ${message.role}`}>
                  <div className="lotti-message-text">{message.text}</div>
                </div>
              ))}

              {pending && (
                <div className="lotti-message assistant pending">
                  <div className="lotti-message-text">Einen Moment bitte …</div>
                </div>
              )}
            </div>

            <div className="lotti-compose">
              <div className="lotti-compose-row">
                <label className="lotti-label sr-only" htmlFor="lotti-question">
                  Ihre Frage an Lotti
                </label>
                <textarea
                  id="lotti-question"
                  className="field lotti-input"
                  placeholder="Frage hier eingeben"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitQuestion();
                    }
                  }}
                  disabled={pending}
                />
                <button className="btn btn-primary lotti-send" onClick={submitQuestion} disabled={pending || !draft.trim()}>
                  Senden
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
