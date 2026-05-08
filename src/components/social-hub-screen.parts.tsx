// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { MessageCircleMore, UsersRound } from "lucide-react";

function formatTime(value, localeTag) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TopicButton({ topic, active, onSelect, t }) {
  return (
    <button
      type="button"
      className={`table-chat-topic-chip ${active ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <div className="table-chat-topic-chip-title">{topic.title}</div>
      <div className="table-chat-topic-chip-subtitle">{topic.subtitle}</div>
      <div className="table-chat-topic-chip-count">{t("socialHub.tables.peopleCount", { count: topic.peopleCount })}</div>
      {active ? <div className="social-hub-topic-selected">{t("socialHub.tables.selected")}</div> : null}
    </button>
  );
}

export function ContactButton({ contact, active, hasUnread, onSelect, t }) {
  return (
    <div className="messaging-contact-row">
      {hasUnread ? (
        <div className="messaging-contact-notice" aria-label={`${t("socialHub.common.new")} ${contact.name}`}>
          <span className="messaging-contact-dot" aria-hidden="true" />
          <span>{t("socialHub.common.new")}</span>
        </div>
      ) : (
        <div className="messaging-contact-notice messaging-contact-notice-empty" aria-hidden="true" />
      )}

      <button
        type="button"
        className={`messaging-contact ${active ? "active" : ""}`}
        onClick={onSelect}
        aria-pressed={active}
      >
        <div className="messaging-contact-main">
          <div className="messaging-contact-name">{contact.name}</div>
          {contact.label ? <div className="messaging-contact-snippet">{contact.label}</div> : null}
        </div>
      </button>
    </div>
  );
}

export function PersonButton({ person, active, onSelect, t }) {
  return (
    <button
      type="button"
      className={`social-hub-person-button ${active ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span>{person.name}</span>
      <strong>{t("socialHub.profile.button")}</strong>
    </button>
  );
}

export function ProfilePanel({ person, t, onPrivateChat, busy, showAction = true, onClose }) {
  if (!person) {
    return (
      <div className="table-chat-profile-card social-hub-profile-card">
        <div className="table-chat-profile-empty">{t("socialHub.profile.empty")}</div>
      </div>
    );
  }

  const interests = person.profile.interests.length ? person.profile.interests.join(" · ") : "";

  return (
    <div className="table-chat-profile-card social-hub-profile-card">
      <div className="table-chat-profile-head">
        <div>
          <div className="table-chat-profile-name">{person.name}</div>
          <div className="table-chat-profile-label">{person.label || t("socialHub.profile.genericLabel")}</div>
        </div>
        <UsersRound size={22} strokeWidth={2.25} />
      </div>

      <div className="table-chat-profile-grid">
        <div className="table-chat-profile-row">
          <span>{t("socialHub.profile.location")}</span>
          <strong>{person.profile.location || "-"}</strong>
        </div>
        <div className="table-chat-profile-row">
          <span>{t("socialHub.profile.age")}</span>
          <strong>{person.profile.age || "-"}</strong>
        </div>
        <div className="table-chat-profile-row">
          <span>{t("socialHub.profile.interests")}</span>
          <strong>{interests || "-"}</strong>
        </div>
        {person.profile.note ? <div className="table-chat-profile-note">{person.profile.note}</div> : null}
      </div>

      {showAction ? (
        <button
          type="button"
          className="btn btn-primary table-chat-private-btn"
          onClick={onPrivateChat}
          disabled={busy}
        >
          {person.isContact ? t("socialHub.profile.openChat") : t("socialHub.profile.privateChat")}
        </button>
      ) : null}

      {onClose ? (
        <button type="button" className="btn social-hub-profile-close" onClick={onClose}>
          {t("common.close")}
        </button>
      ) : null}
    </div>
  );
}

export function PrivateConversation({
  contact,
  area,
  draft,
  error,
  sending,
  timelineEndRef,
  showProfile,
  onToggleProfile,
  onDraftChange,
  onSend,
  t,
  localeTag,
}) {
  if (!contact) {
    const emptyKey = area === "care" ? "socialHub.care.empty" : "socialHub.friends.empty";

    return (
      <section className="messaging-panel" aria-label={t("socialHub.private.aria")}>
        <div className="messaging-panel-empty">{t(emptyKey)}</div>
        {error ? (
          <div className="messaging-error" role="alert">
            {error}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="messaging-panel" aria-label={t("socialHub.private.aria")}>
      <div className="messaging-conversation-head social-hub-conversation-head">
        <div className="social-hub-conversation-titlebar">
          <div>
            <h2>{contact.name}</h2>
            <p>{area === "care" ? t("socialHub.care.lead") : contact.label || t("socialHub.friends.lead")}</p>
          </div>
          <button type="button" className="btn social-hub-profile-toggle" onClick={onToggleProfile}>
            {showProfile ? t("common.close") : t("socialHub.profile.show")}
          </button>
        </div>

        {showProfile ? (
          <div className="social-hub-private-profile">
            <ProfilePanel person={{ ...contact, isContact: true }} t={t} showAction={false} onClose={onToggleProfile} />
          </div>
        ) : null}
      </div>

      <div className="messaging-timeline">
        {!contact.messages.length ? (
          <div className="messaging-empty-state">
            <MessageCircleMore size={32} strokeWidth={2.25} />
            <div>{t("socialHub.private.noMessages")}</div>
          </div>
        ) : null}

        {contact.messages.map((message) => (
          <div key={message.id} className={`messaging-bubble ${message.role === "own" ? "own" : "other"}`}>
            <div className="messaging-bubble-text">{message.text}</div>
            <div className="messaging-bubble-time">{formatTime(message.timestamp, localeTag)}</div>
          </div>
        ))}
        <div ref={timelineEndRef} />
      </div>

      <div className="messaging-compose">
        <label className="sr-only" htmlFor="social-hub-private-draft">
          {t("socialHub.private.label")}
        </label>
        <textarea
          id="social-hub-private-draft"
          className="field messaging-input"
          placeholder={t("socialHub.private.placeholder")}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          disabled={sending}
        />
        <button type="button" className="btn btn-primary messaging-send" onClick={onSend} disabled={sending || !draft.trim()}>
          {sending ? t("socialHub.common.sending") : t("socialHub.common.send")}
        </button>
      </div>

      {error ? (
        <div className="messaging-error" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}

export function TableConversation({
  topic,
  joined,
  messages,
  draft,
  error,
  sending,
  joining,
  canJoin = true,
  closedText,
  timelineEndRef,
  onDraftChange,
  onSend,
  onJoin,
  onAuthorSelect,
  onPeopleOpen,
  peopleCount = 0,
  showPeopleButton = false,
  t,
  localeTag,
  currentUserId,
}) {
  return (
    <section className="messaging-panel" aria-label={t("socialHub.tables.aria")}>
      <div className="messaging-conversation-head">
        <div>
          <h2>{topic?.title || t("socialHub.tables.emptyTitle")}</h2>
          <p>{topic?.description || t("socialHub.tables.emptyLead")}</p>
        </div>
        {showPeopleButton ? (
          <button type="button" className="btn social-hub-people-toggle" onClick={onPeopleOpen}>
            <UsersRound size={22} strokeWidth={2.25} />
            {t("socialHub.people.button", { count: peopleCount })}
          </button>
        ) : null}
      </div>

      {!joined ? (
        <div className="social-hub-join-panel">
          <div className="messaging-empty-state social-hub-join-card">
            <UsersRound size={34} strokeWidth={2.25} />
            <div>
              <strong>{canJoin ? t("socialHub.tables.joinTitle") : t("socialHub.groups.empty")}</strong>
              <p>{closedText || (canJoin ? t("socialHub.tables.joinText") : t("socialHub.groups.emptyHint"))}</p>
            </div>
          </div>
          {canJoin ? (
            <button type="button" className="btn btn-primary social-hub-join-button" onClick={onJoin} disabled={joining}>
              {joining ? t("socialHub.tables.joining") : t("socialHub.tables.join")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="messaging-timeline">
            {!messages.length ? (
              <div className="messaging-empty-state">
                <MessageCircleMore size={32} strokeWidth={2.25} />
                <div>{t("socialHub.tables.noMessages")}</div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div key={message.id} className={`messaging-bubble ${message.role === "own" ? "own" : "other"}`}>
                {message.senderId === currentUserId ? (
                  <div className="table-chat-message-author">{message.senderName}</div>
                ) : (
                  <button
                    type="button"
                    className="table-chat-message-author social-hub-message-author"
                    onClick={() => onAuthorSelect(message.senderId)}
                  >
                    {message.senderName}
                  </button>
                )}
                <div className="messaging-bubble-text">{message.text}</div>
                <div className="messaging-bubble-time">{formatTime(message.timestamp, localeTag)}</div>
              </div>
            ))}
            <div ref={timelineEndRef} />
          </div>

          <div className="messaging-compose">
            <label className="sr-only" htmlFor="social-hub-table-draft">
              {t("socialHub.tables.label")}
            </label>
            <textarea
              id="social-hub-table-draft"
              className="field messaging-input"
              placeholder={t("socialHub.tables.placeholder")}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              disabled={sending}
            />
            <button type="button" className="btn btn-primary messaging-send" onClick={onSend} disabled={sending || !draft.trim()}>
              {sending ? t("socialHub.common.sending") : t("socialHub.common.send")}
            </button>
          </div>
        </>
      )}

      {error ? (
        <div className="messaging-error" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
