// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { HeartHandshake, LoaderCircle, MessageCircleMore, UsersRound, UserRoundCheck, Wine } from "lucide-react";
import {
  connectSocialHubTablePersonAction,
  getSocialHubBootstrap,
  sendSocialHubPrivateMessageAction,
  sendSocialHubTableMessageAction,
  selectSocialHubGroupTopicAction,
  setSocialHubTopicAction,
} from "@/app/actions/social-hub";
import { useAppState } from "./app-provider";

const AREAS = {
  CARE: "care",
  FRIENDS: "friends",
  GROUPS: "groups",
  PUBLIC: "public",
};

function formatTime(value, localeTag) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function getDefaultArea(payload) {
  return payload?.caretakers?.length ? AREAS.CARE : AREAS.FRIENDS;
}

function findContactArea(payload, contactId) {
  if (!contactId) {
    return "";
  }

  if (payload?.caretakers?.some((contact) => contact.id === contactId)) {
    return AREAS.CARE;
  }

  if (payload?.friends?.some((contact) => contact.id === contactId)) {
    return AREAS.FRIENDS;
  }

  return "";
}

function getInitialArea(value) {
  if (value === AREAS.GROUPS || value === "tables") {
    return AREAS.GROUPS;
  }

  if (value === AREAS.PUBLIC) {
    return AREAS.PUBLIC;
  }

  return "";
}

function TopicButton({ topic, active, onSelect, t }) {
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

function ContactButton({ contact, active, hasUnread, onSelect, t }) {
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

function PersonButton({ person, active, onSelect, t }) {
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

function ProfilePanel({ person, t, onPrivateChat, busy, showAction = true, onClose }) {
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

function PrivateConversation({
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
    const emptyKey = area === AREAS.CARE ? "socialHub.care.empty" : "socialHub.friends.empty";

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
            <p>{area === AREAS.CARE ? t("socialHub.care.lead") : contact.label || t("socialHub.friends.lead")}</p>
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

function TableConversation({
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

export function SocialHubScreen({ initialContactId = "", initialArea = "" }) {
  const { t, localeTag } = useAppState();
  const refreshTimerRef = React.useRef(null);
  const privateEndRef = React.useRef(null);
  const tableEndRef = React.useRef(null);
  const initialContactAppliedRef = React.useRef(false);
  const [bootstrap, setBootstrap] = React.useState(null);
  const [activeArea, setActiveArea] = React.useState(getInitialArea(initialArea));
  const [selectedGroupTopicId, setSelectedGroupTopicId] = React.useState("");
  const [selectedContactId, setSelectedContactId] = React.useState(initialContactId);
  const [previewTopicId, setPreviewTopicId] = React.useState("");
  const [selectedPersonId, setSelectedPersonId] = React.useState("");
  const [showPrivateProfile, setShowPrivateProfile] = React.useState(false);
  const [showTableProfile, setShowTableProfile] = React.useState(false);
  const [showGroupPeople, setShowGroupPeople] = React.useState(false);
  const [tableSearch, setTableSearch] = React.useState("");
  const [lastReadByContact, setLastReadByContact] = React.useState({});
  const [privateDraft, setPrivateDraft] = React.useState("");
  const [tableDraft, setTableDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [sendingPrivate, setSendingPrivate] = React.useState(false);
  const [sendingTable, setSendingTable] = React.useState(false);
  const [joiningTable, setJoiningTable] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);

  const applyBootstrap = React.useCallback((payload) => {
    setBootstrap(payload);

    setActiveArea((currentArea) => {
      const contactArea = findContactArea(payload, initialContactId);
      return currentArea || contactArea || getDefaultArea(payload);
    });

    setSelectedContactId((currentContactId) => {
      const allContacts = [...(payload.caretakers || []), ...(payload.friends || [])];

      if (
        !initialContactAppliedRef.current &&
        initialContactId &&
        allContacts.some((contact) => contact.id === initialContactId)
      ) {
        initialContactAppliedRef.current = true;
        return initialContactId;
      }

      if (currentContactId && allContacts.some((contact) => contact.id === currentContactId)) {
        return currentContactId;
      }

      return payload.caretakers[0]?.id || payload.friends[0]?.id || "";
    });

    setSelectedPersonId((currentPersonId) => {
      const people = payload.table?.people || [];

      if (currentPersonId && people.some((person) => person.id === currentPersonId)) {
        return currentPersonId;
      }

      return people[0]?.id || "";
    });

    setPreviewTopicId((currentTopicId) => {
      const publicTopics = (payload.table?.topics || []).filter(
        (topic) => !(payload.table?.joinedTopicIds || []).includes(topic.id)
      );

      if (currentTopicId && publicTopics.some((topic) => topic.id === currentTopicId)) {
        return currentTopicId;
      }

      return publicTopics[0]?.id || "";
    });

    setSelectedGroupTopicId((currentTopicId) => {
      const joinedTopicIds = payload.table?.joinedTopicIds || [];

      if (currentTopicId && joinedTopicIds.includes(currentTopicId)) {
        return currentTopicId;
      }

      return payload.table?.currentTopic?.id || joinedTopicIds[0] || "";
    });
  }, [initialContactId]);

  const loadBootstrap = React.useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    setError("");

    try {
      const payload = await getSocialHubBootstrap();
      applyBootstrap(payload);
    } catch {
      setError(t("socialHub.errors.load"));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [applyBootstrap, t]);

  React.useEffect(() => {
    let cancelled = false;

    // Initial data loading belongs in an effect because this is a client screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBootstrap(true).then(() => {
      if (!cancelled) {
        refreshTimerRef.current = window.setInterval(() => {
          loadBootstrap(false);
        }, 3000);
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

  const caretakers = bootstrap?.caretakers || [];
  const friends = bootstrap?.friends || [];
  const topics = bootstrap?.table?.topics || [];
  const joinedTopicIds = bootstrap?.table?.joinedTopicIds || [];
  const joinedTopics = topics.filter((topic) => joinedTopicIds.includes(topic.id));
  const publicTopics = topics.filter((topic) => !joinedTopicIds.includes(topic.id));
  const currentTableTopic = bootstrap?.table?.currentTopic || null;
  const joinedTopic =
    currentTableTopic && joinedTopicIds.includes(currentTableTopic.id) ? currentTableTopic : joinedTopics[0] || null;
  const selectedGroupTopic = joinedTopics.find((topic) => topic.id === selectedGroupTopicId) || joinedTopic;
  const previewTopic = publicTopics.find((topic) => topic.id === previewTopicId) || publicTopics[0] || null;
  const normalizedTableSearch = tableSearch.trim().toLowerCase();
  const visibleTopics = normalizedTableSearch
    ? publicTopics.filter((topic) =>
        `${topic.title} ${topic.subtitle} ${topic.description}`.toLowerCase().includes(normalizedTableSearch)
      )
    : publicTopics;
  const people = bootstrap?.table?.people || [];
  const selectedPerson = people.find((person) => person.id === selectedPersonId) || people[0] || null;
  const privateContacts = activeArea === AREAS.CARE ? caretakers : friends;
  const selectedConversation =
    privateContacts.find((contact) => contact.id === selectedContactId) || privateContacts[0] || null;
  const isTableArea = activeArea === AREAS.GROUPS || activeArea === AREAS.PUBLIC;

  React.useEffect(() => {
    if (!selectedConversation?.id) {
      return;
    }

    const latestIncomingTimestamp = getLastIncomingTimestamp(selectedConversation, bootstrap?.user?.id);

    if (!latestIncomingTimestamp) {
      return;
    }

    // Keep the small "new" marker calm: reading a conversation clears it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastReadByContact((current) => {
      if (current[selectedConversation.id] === latestIncomingTimestamp) {
        return current;
      }

      return {
        ...current,
        [selectedConversation.id]: latestIncomingTimestamp,
      };
    });
  }, [bootstrap?.user?.id, selectedConversation]);

  React.useEffect(() => {
    if ((activeArea === AREAS.CARE || activeArea === AREAS.FRIENDS) && privateEndRef.current) {
      privateEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [activeArea, selectedConversation?.id, selectedConversation?.messages?.length]);

  React.useEffect(() => {
    if (activeArea === AREAS.GROUPS && tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [activeArea, joinedTopic?.id, bootstrap?.table?.messages?.length]);

  function switchArea(nextArea) {
    setActiveArea(nextArea);
    setError("");
    setShowPrivateProfile(false);
    setShowTableProfile(false);
    setShowGroupPeople(false);

    if (nextArea === AREAS.CARE) {
      setSelectedContactId(caretakers[0]?.id || "");
    }

    if (nextArea === AREAS.FRIENDS) {
      setSelectedContactId(friends[0]?.id || "");
    }

    if (nextArea === AREAS.PUBLIC) {
      setPreviewTopicId((currentTopicId) => currentTopicId || publicTopics[0]?.id || "");
    }

    if (nextArea === AREAS.GROUPS) {
      setSelectedGroupTopicId((currentTopicId) => currentTopicId || joinedTopics[0]?.id || "");
    }
  }

  function selectTopic(topicId) {
    if (!topicId) {
      return;
    }

    setError("");
    setPreviewTopicId(topicId);
    setShowTableProfile(false);
    setShowGroupPeople(false);
  }

  async function selectGroupTopic(topicId) {
    if (!topicId || topicId === joinedTopic?.id) {
      return;
    }

    setError("");
    setSelectedGroupTopicId(topicId);
    setShowTableProfile(false);
    setShowGroupPeople(false);

    try {
      const payload = await selectSocialHubGroupTopicAction(topicId);
      setBootstrap(payload);
      setSelectedPersonId(payload.table.people[0]?.id || "");
    } catch {
      setError(t("socialHub.errors.topic"));
    }
  }

  async function joinPreviewTopic() {
    if (!previewTopic?.id || joiningTable) {
      return;
    }

    setJoiningTable(true);
    setError("");

    try {
      const payload = await setSocialHubTopicAction(previewTopic.id);
      setBootstrap(payload);
      setSelectedGroupTopicId(payload.table.currentTopic.id);
      setPreviewTopicId("");
      setSelectedPersonId(payload.table.people[0]?.id || "");
      setShowTableProfile(false);
      setShowGroupPeople(false);
      setActiveArea(AREAS.GROUPS);
    } catch {
      setError(t("socialHub.errors.topic"));
    } finally {
      setJoiningTable(false);
    }
  }

  async function sendPrivateMessage() {
    const text = privateDraft.trim();

    if (!selectedConversation?.id || !text || sendingPrivate) {
      return;
    }

    setSendingPrivate(true);
    setError("");

    try {
      await sendSocialHubPrivateMessageAction(selectedConversation.id, text);
      setPrivateDraft("");
      await loadBootstrap(false);
    } catch {
      setError(t("socialHub.errors.sendPrivate"));
    } finally {
      setSendingPrivate(false);
    }
  }

  async function sendTableMessage() {
    const text = tableDraft.trim();

    if (!selectedGroupTopic?.id || !text || sendingTable) {
      return;
    }

    setSendingTable(true);
    setError("");

    try {
      await sendSocialHubTableMessageAction(selectedGroupTopic.id, text);
      setTableDraft("");
      await loadBootstrap(false);
    } catch {
      setError(t("socialHub.errors.sendTable"));
    } finally {
      setSendingTable(false);
    }
  }

  async function openPrivateChat() {
    if (!selectedPerson?.id || connecting) {
      return;
    }

    setConnecting(true);
    setError("");

    try {
      const payload = await connectSocialHubTablePersonAction(selectedPerson.id);
      setBootstrap(payload);
      setActiveArea(selectedPerson.role === "caregiver" ? AREAS.CARE : AREAS.FRIENDS);
      setSelectedContactId(selectedPerson.id);
      setShowTableProfile(false);
      setShowGroupPeople(false);
    } catch {
      setError(t("socialHub.errors.privateChat"));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="app social-hub-app">
      <div className="app-header social-hub-header">
        <div>
          <h1 className="app-title">{t("socialHub.title")}</h1>
          <p className="social-hub-subtitle">{t("socialHub.subtitle")}</p>
        </div>

        <nav className="social-hub-area-nav" aria-label={t("socialHub.navigation.aria")}>
          <button
            type="button"
            className={`social-hub-area-tab ${activeArea === AREAS.CARE ? "active" : ""}`}
            onClick={() => switchArea(AREAS.CARE)}
          >
            <HeartHandshake size={24} strokeWidth={2.25} />
            {t("socialHub.navigation.care")}
          </button>
          <button
            type="button"
            className={`social-hub-area-tab ${activeArea === AREAS.FRIENDS ? "active" : ""}`}
            onClick={() => switchArea(AREAS.FRIENDS)}
          >
            <UserRoundCheck size={24} strokeWidth={2.25} />
            {t("socialHub.navigation.friends")}
          </button>
          <button
            type="button"
            className={`social-hub-area-tab ${activeArea === AREAS.GROUPS ? "active" : ""}`}
            onClick={() => switchArea(AREAS.GROUPS)}
          >
            <Wine size={24} strokeWidth={2.25} />
            {t("socialHub.navigation.groups")}
          </button>
          <button
            type="button"
            className={`social-hub-area-tab ${activeArea === AREAS.PUBLIC ? "active" : ""}`}
            onClick={() => switchArea(AREAS.PUBLIC)}
          >
            <UsersRound size={24} strokeWidth={2.25} />
            {t("socialHub.navigation.public")}
          </button>
        </nav>
      </div>

      <div className="app-body">
        <div className={`messaging-shell social-hub-shell ${isTableArea ? "tables" : ""}`}>
          <aside className="messaging-sidebar social-hub-sidebar" aria-label={t("socialHub.sidebar.aria")}>
            {loading ? (
              <div className="messaging-placeholder">
                <LoaderCircle className="spin" size={24} strokeWidth={2.25} />
                {t("common.loading")}
              </div>
            ) : null}

            {isTableArea ? (
              <div className="social-hub-sidebar-scroll">
                {activeArea === AREAS.GROUPS ? (
                  <div className="table-chat-sidebar-section">
                    <div className="table-chat-section-title">{t("socialHub.groups.title")}</div>
                    {!joinedTopics.length ? (
                      <div className="messaging-placeholder social-hub-inline-placeholder">
                        {t("socialHub.groups.empty")}
                      </div>
                    ) : null}
                    <div className="table-chat-topic-list">
                      {joinedTopics.map((topic) => (
                        <TopicButton
                          key={topic.id}
                          topic={topic}
                          active={joinedTopic?.id === topic.id}
                          t={t}
                          onSelect={() => selectGroupTopic(topic.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="table-chat-sidebar-section">
                    <div className="table-chat-section-title">{t("socialHub.tables.title")}</div>
                    <label className="sr-only" htmlFor="social-hub-table-search">
                      {t("socialHub.tables.searchLabel")}
                    </label>
                    <input
                      id="social-hub-table-search"
                      className="field social-hub-table-search"
                      value={tableSearch}
                      placeholder={t("socialHub.tables.searchPlaceholder")}
                      onChange={(event) => setTableSearch(event.target.value)}
                    />
                    <div className="table-chat-topic-list">
                      {!visibleTopics.length ? (
                        <div className="messaging-placeholder social-hub-inline-placeholder">
                          {t("socialHub.tables.noResults")}
                        </div>
                      ) : null}
                      {visibleTopics.map((topic) => (
                        <TopicButton
                          key={topic.id}
                          topic={topic}
                          active={previewTopic?.id === topic.id}
                          t={t}
                          onSelect={() => selectTopic(topic.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="messaging-contact-list">
                {!loading && !privateContacts.length ? (
                  <div className="messaging-placeholder social-hub-inline-placeholder">
                    {activeArea === AREAS.CARE ? t("socialHub.care.empty") : t("socialHub.friends.empty")}
                  </div>
                ) : null}

                {privateContacts.map((contact) => {
                  const incomingTimestamp = getLastIncomingTimestamp(contact, bootstrap?.user?.id);
                  const hasUnread = Boolean(
                    incomingTimestamp &&
                      incomingTimestamp !== lastReadByContact[contact.id] &&
                      selectedConversation?.id !== contact.id
                  );

                  return (
                    <ContactButton
                      key={contact.id}
                      contact={contact}
                      active={selectedConversation?.id === contact.id}
                      hasUnread={hasUnread}
                      t={t}
                      onSelect={() => {
                        setSelectedContactId(contact.id);
                        setShowPrivateProfile(false);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </aside>

          {activeArea === AREAS.GROUPS ? (
            <>
              <TableConversation
                topic={selectedGroupTopic}
                joined={Boolean(selectedGroupTopic)}
                messages={bootstrap?.table?.messages || []}
                draft={tableDraft}
                error={error}
                sending={sendingTable}
                joining={false}
                canJoin={false}
                timelineEndRef={tableEndRef}
                onDraftChange={setTableDraft}
                onSend={sendTableMessage}
                onJoin={() => {}}
                onAuthorSelect={(personId) => {
                  setSelectedPersonId(personId);
                  setShowTableProfile(true);
                }}
                onPeopleOpen={() => setShowGroupPeople(true)}
                peopleCount={people.length}
                showPeopleButton={Boolean(selectedGroupTopic)}
                t={t}
                localeTag={localeTag}
                currentUserId={bootstrap?.user?.id}
              />

              {showGroupPeople ? (
                <div className="social-hub-profile-backdrop" onClick={() => setShowGroupPeople(false)}>
                  <aside
                    className="social-hub-profile-panel"
                    aria-label={t("socialHub.people.title")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="table-chat-profile-overlay-label">{t("socialHub.people.title")}</div>
                    {!people.length ? (
                      <div className="messaging-placeholder social-hub-inline-placeholder">{t("socialHub.people.empty")}</div>
                    ) : null}
                    <div className="social-hub-person-list">
                      {people.map((person) => (
                        <PersonButton
                          key={person.id}
                          person={person}
                          active={selectedPerson?.id === person.id}
                          t={t}
                          onSelect={() => {
                            setSelectedPersonId(person.id);
                            setShowGroupPeople(false);
                            setShowTableProfile(true);
                          }}
                        />
                      ))}
                    </div>
                    <button type="button" className="btn social-hub-profile-close" onClick={() => setShowGroupPeople(false)}>
                      {t("common.close")}
                    </button>
                  </aside>
                </div>
              ) : null}

              {showTableProfile ? (
                <div className="social-hub-profile-backdrop" onClick={() => setShowTableProfile(false)}>
                  <aside
                    className="social-hub-profile-panel"
                    aria-label={t("socialHub.profile.title")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="table-chat-profile-overlay-label">{t("socialHub.profile.title")}</div>
                    <ProfilePanel
                      person={selectedPerson}
                      t={t}
                      onPrivateChat={openPrivateChat}
                      busy={connecting}
                      onClose={() => setShowTableProfile(false)}
                    />
                  </aside>
                </div>
              ) : null}
            </>
          ) : activeArea === AREAS.PUBLIC ? (
            <TableConversation
              topic={previewTopic}
              joined={false}
              messages={[]}
              draft={tableDraft}
              error={error}
              sending={sendingTable}
              joining={joiningTable}
              canJoin={Boolean(previewTopic)}
              timelineEndRef={tableEndRef}
              onDraftChange={setTableDraft}
              onSend={sendTableMessage}
              onJoin={joinPreviewTopic}
              onAuthorSelect={() => {}}
              onPeopleOpen={() => {}}
              t={t}
              localeTag={localeTag}
              currentUserId={bootstrap?.user?.id}
            />
          ) : (
            <PrivateConversation
              contact={selectedConversation}
              area={activeArea}
              draft={privateDraft}
              error={error}
              sending={sendingPrivate}
              timelineEndRef={privateEndRef}
              showProfile={showPrivateProfile}
              onToggleProfile={() => setShowPrivateProfile((current) => !current)}
              onDraftChange={setPrivateDraft}
              onSend={sendPrivateMessage}
              t={t}
              localeTag={localeTag}
            />
          )}
        </div>
      </div>
    </div>
  );
}
