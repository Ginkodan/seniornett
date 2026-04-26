// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";
import React from "react";

import { getMessagingBootstrap, sendMessageAction } from "@/app/actions/messaging";
import { LoaderCircle, MessageCircleMore } from "lucide-react";
import { useAppState } from "./app-provider";
import { SeniorNetPage } from "./ui";
import styles from "./messaging-social.module.css";

function formatTime(value, localeTag) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildConversations(contacts) {
  return (contacts || []).map((contact) => ({
    ...contact,
    messages: contact.messages || [],
  }));
}

function getLastIncomingTimestamp(contact, currentUserId) {
  const messages = contact?.messages || [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.senderId !== currentUserId) {
      return message.timestamp || "";
    }
  }

  return "";
}

export function MessagingScreen({ initialContactId = "" }) {
  const { t, localeTag } = useAppState();
  const refreshTimerRef = React.useRef(null);
  const [lastReadByContact, setLastReadByContact] = React.useState({});
  const [bootstrap, setBootstrap] = React.useState(null);
  const [conversations, setConversations] = React.useState([]);
  const [selectedContactId, setSelectedContactId] = React.useState(initialContactId);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const loadBootstrap = React.useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    setError("");

    try {
      const payload = await getMessagingBootstrap();
      setBootstrap(payload);

      const nextConversations = buildConversations(payload.contacts || []);
      setConversations(nextConversations);
      setSelectedContactId((current) => current || nextConversations[0]?.id || "");
    } catch {
      setError(t("messaging.conversation.loadError"));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [t]);

  React.useEffect(() => {
    let cancelled = false;

    // Initial load is intentionally kicked off from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBootstrap(true).then(() => {
      if (!cancelled) {
        refreshTimerRef.current = window.setInterval(() => {
          loadBootstrap(false);
        }, 2500);
      }
    });

    return () => {
      cancelled = true;

      if (refreshTimerRef.current) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [loadBootstrap]);

  React.useEffect(() => {
    if (!selectedContactId || !conversations.length) {
      return;
    }

    const activeConversation = conversations.find((entry) => entry.id === selectedContactId);

    const latestIncomingTimestamp = getLastIncomingTimestamp(activeConversation, bootstrap?.user?.id);

    if (!latestIncomingTimestamp) {
      return;
    }

    // Mark the latest incoming message as read for the active contact.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastReadByContact((current) => {
      if (current[selectedContactId] === latestIncomingTimestamp) {
        return current;
      }

      return {
        ...current,
        [selectedContactId]: latestIncomingTimestamp,
      };
    });
  }, [bootstrap?.user?.id, selectedContactId, conversations]);

  const selectedConversation = React.useMemo(() => {
    const liveConversation =
      conversations.find((entry) => entry.id === selectedContactId) || conversations[0] || null;

    if (liveConversation) {
      return liveConversation;
    }

    const fallbackContact =
      bootstrap?.contacts?.find((entry) => entry.id === selectedContactId) ||
      bootstrap?.contacts?.[0] ||
      null;

    if (!fallbackContact) {
      return null;
    }

    return {
      ...fallbackContact,
      messages: [],
    };
  }, [bootstrap, conversations, selectedContactId]);

  const sendMessage = React.useCallback(async () => {
    const text = draft.trim();

    if (!selectedConversation?.id || !text || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      await sendMessageAction(selectedConversation.id, text);
      setDraft("");
      await loadBootstrap(false);
    } catch {
      setError(t("messaging.conversation.sendError"));
    } finally {
      setSending(false);
    }
  }, [draft, selectedConversation, sending, loadBootstrap, t]);

  return (
    <SeniorNetPage title={t("messaging.title")}>
      <div className={styles.scope}>
        <div className="messaging-shell">
          <aside className="messaging-sidebar" aria-label={t("messaging.contacts.aria")}>
            {loading ? (
              <div className="messaging-placeholder">
                <LoaderCircle className="spin" size={24} strokeWidth={2.25} />
                {t("messaging.contacts.loading")}
              </div>
            ) : null}

            {!loading && !bootstrap?.contacts?.length ? (
              <div className="messaging-placeholder">
                {t("messaging.contacts.empty")}
              </div>
            ) : null}

            <div className="messaging-contact-list">
              {(conversations.length ? conversations : bootstrap?.contacts || []).map((contact) => (
                <div key={contact.id} className="messaging-contact-row">
                  {(() => {
                    const incomingTimestamp = getLastIncomingTimestamp(contact, bootstrap?.user?.id);
                    const hasUnread = Boolean(
                      incomingTimestamp &&
                      incomingTimestamp !== lastReadByContact[contact.id] &&
                      selectedConversation?.id !== contact.id
                    );

                    return hasUnread ? (
                      <div className="messaging-contact-notice" aria-label={`${t("messaging.contacts.new")} ${contact.name}`}>
                        <span className="messaging-contact-dot" aria-hidden="true" />
                        <span>{t("messaging.contacts.new")}</span>
                      </div>
                    ) : (
                      <div className="messaging-contact-notice messaging-contact-notice-empty" aria-hidden="true" />
                    );
                  })()}

                  <button
                    className={`messaging-contact ${selectedConversation?.id === contact.id ? "active" : ""}`}
                    onClick={() => setSelectedContactId(contact.id)}
                  >
                    <div className="messaging-contact-main">
                      <div className="messaging-contact-name">{contact.name}</div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </aside>

            <section className="messaging-panel" aria-label={t("messaging.conversation.aria")}>
              {selectedConversation ? (
                <>
                  <div className="messaging-conversation-head">
                    <div>
                      <h2>{selectedConversation.name}</h2>
                      <p>
                        {selectedConversation.label ||
                        (selectedConversation.role === "caregiver" ? t("messaging.conversation.caregiver") : t("messaging.conversation.contact"))}
                      </p>
                    </div>
                  </div>

                  <div className="messaging-timeline">
                    {!selectedConversation.messages.length ? (
                      <div className="messaging-empty-state">
                        <MessageCircleMore size={32} strokeWidth={2.25} />
                        <div>{t("messaging.conversation.empty")}</div>
                      </div>
                    ) : null}

                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`messaging-bubble ${message.role === "own" ? "own" : "other"}`}
                    >
                      <div className="messaging-bubble-text">{message.text}</div>
                      <div className="messaging-bubble-time">{formatTime(message.timestamp, localeTag)}</div>
                    </div>
                  ))}
                </div>

                <div className="messaging-compose">
                  <label className="sr-only" htmlFor="message-draft">
                    {t("messaging.conversation.label")}
                  </label>
                  <textarea
                    id="message-draft"
                    className="field messaging-input"
                    placeholder={t("messaging.conversation.placeholder")}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={sending}
                  />
                  <button
                    className="btn btn-primary messaging-send"
                    onClick={sendMessage}
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? t("messaging.conversation.sending") : t("messaging.conversation.send")}
                  </button>
                </div>
              </>
            ) : (
              <div className="messaging-panel-empty">
                {t("messaging.conversation.selectContact")}
              </div>
            )}

            {error ? (
              <div className="messaging-error" role="alert">
                {error}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </SeniorNetPage>
  );
}
