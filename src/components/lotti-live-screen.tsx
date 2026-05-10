"use client";

import React from 'react';
import Image from 'next/image';
import { useAppState } from './app-provider';
import { SeniorNetPage } from './ui';
import { ChatMarkdown } from './chat-markdown';
import lottiAvatar from "../../assets/lotti.png";
import styles from "./lotti-live-screen.module.css";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  source?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type AskLottiAction = (
  message: string,
  history: Array<{ role: ChatRole; text: string }>,
  language?: string,
  runtime?: { location?: UserLocation }
) => Promise<{ ok: boolean; text: string; source: string }>;

type LottiLiveScreenProps = {
  askLottiAction: AskLottiAction;
};

export function LottiLiveScreen({ askLottiAction }: LottiLiveScreenProps) {
  const { t, locale } = useAppState();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [location, setLocation] = React.useState<UserLocation | undefined>();
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, pending]);

  React.useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        setLocation(undefined);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }, []);

  const submitQuestion = async () => {
    const text = draft.trim();
    if (!text || pending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setPending(true);

    try {
      const history = messages.map(({ role, text }) => ({ role, text }));
      const result = await askLottiAction(text, history, locale, { location });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result?.text || t('lotti.fallback.general'),
          source: result?.source || "fallback",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: t('lotti.fallback.general'),
          source: "fallback",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <SeniorNetPage title={t('lotti.title')} subtitle={t('lotti.subtitle')} tone="coral">
      <div className={styles.scope}>
        <div className="lotti-shell">
          <div className="lotti-card">
            <div className="lotti-messages" ref={listRef}>
              {!messages.length && !pending && (
                <div className="lotti-empty-state">
                  <div className="lotti-empty-intro">
                    <Image
                      src={lottiAvatar}
                      alt=""
                      aria-hidden="true"
                      className="lotti-empty-avatar"
                      priority
                    />
                    <p>{t('lotti.empty')}</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`lotti-message ${message.role}`}>
                  {message.role === 'assistant' ? (
                    <Image
                      src={lottiAvatar}
                      alt=""
                      aria-hidden="true"
                      className="lotti-message-avatar"
                    />
                  ) : null}
                  <div className="lotti-message-text">
                    <ChatMarkdown text={message.text} />
                  </div>
                </div>
              ))}

              {pending && (
                <div className="lotti-message assistant pending">
                  <Image
                    src={lottiAvatar}
                    alt=""
                    aria-hidden="true"
                    className="lotti-message-avatar"
                  />
                  <div className="lotti-message-text">
                    <ChatMarkdown text={t('lotti.pending')} />
                  </div>
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
                    if (event.key === "Enter" && !event.shiftKey) {
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
