// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { useAppState } from './app-provider';
import { SeniorNetPage } from './ui';
import styles from "./lotti-live-screen.module.css";

export function LottiLiveScreen({ askLottiAction }) {
  const { t, locale } = useAppState();
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
      const result = await askLottiAction(text, history, locale);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result?.text || t('lotti.fallback.general'),
          source: result?.source || 'fallback',
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: t('lotti.fallback.general'),
          source: 'fallback',
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const fillExample = (text) => {
    if (pending) return;
    setDraft(text);
  };

  return (
    <SeniorNetPage title={t('lotti.title')}>
      <div className={styles.scope}>
        <div className="lotti-shell">
          <div className="lotti-card">
            <div className="lotti-messages" ref={listRef}>
              {!messages.length && !pending && (
                <div className="lotti-empty-state">
                  <div className="lotti-empty-intro">
                    <h2>{t('lotti.emptyTitle')}</h2>
                    <p>{t('lotti.empty')}</p>
                  </div>
                  <div className="lotti-example-list" aria-label={t('lotti.examplesLabel')}>
                    {[0, 1, 2].map((index) => {
                      const text = t(`lotti.examples.${index}`);
                      return (
                        <button key={text} type="button" className="lotti-example-button" onClick={() => fillExample(text)}>
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`lotti-message ${message.role}`}>
                  <div className="lotti-message-text">{message.text}</div>
                </div>
              ))}

              {pending && (
                <div className="lotti-message assistant pending">
                  <div className="lotti-message-text">{t('lotti.pending')}</div>
                </div>
              )}
            </div>

            <div className="lotti-compose">
              <div className="lotti-compose-row">
                <label className="lotti-label sr-only" htmlFor="lotti-question">
                  {t('lotti.label')}
                </label>
                <textarea
                  id="lotti-question"
                  className="field lotti-input"
                  placeholder={t('lotti.placeholder')}
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
                  {t('lotti.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SeniorNetPage>
  );
}
