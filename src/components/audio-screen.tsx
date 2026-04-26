// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { BookOpen, Headphones, Pause, Play, Radio, Square } from "lucide-react";
import { AUDIOBOOK_GENRES, BOOK_FILTER_ALL } from "../lib/audio/genres";
import { useAppState } from "./app-provider";
import styles from "./audio-screen.module.css";

const TABS = [
  { id: "radio", key: "radio", icon: Radio },
  { id: "programs", key: "programs", icon: Headphones },
  { id: "books", key: "books", icon: BookOpen },
];

function formatDate(value, localeTag) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(localeTag, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function buildFallbackData(t) {
  return {
    radioStations: [
      {
        id: "radio-swiss-pop",
        title: t("audio.fallback.radioTitle"),
        description: t("audio.fallback.radioDescription"),
        section: "radio",
        url: "https://stream.srg-ssr.ch/srgssr/rsp/mp3/128",
        meta: t("audio.fallback.radioMeta"),
      },
    ],
    audioPrograms: [],
    audiobookSources: [],
    error: "",
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const safeSeconds = Math.floor(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function TabButton({ active, label, icon: Icon, onClick }) {
  return (
    <button className={`audio-tab ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <Icon size={20} strokeWidth={2.3} />
      <span>{label}</span>
    </button>
  );
}

function RadioCard({ station, active, onSelect }) {
  return (
    <button className={`audio-choice ${active ? "active" : ""}`} onClick={() => onSelect(station)}>
      <div className="audio-choice-title">{station.title}</div>
      <div className="audio-choice-description">{station.description}</div>
      <div className="audio-choice-meta">{station.meta}</div>
    </button>
  );
}

function MediaCard({ item, active, onSelect, localeTag }) {
  return (
    <button className={`audio-media-card ${active ? "active" : ""}`} onClick={() => onSelect(item)}>
      <div className="audio-media-card-title">{item.title}</div>
      <div className="audio-media-card-description">{item.description}</div>
      <div className="audio-media-card-meta">
        {[item.author, item.subtitle, item.duration, formatDate(item.publishedAt, localeTag)].filter(Boolean).join(" · ")}
      </div>
    </button>
  );
}

function mergeBookLibrary(audiobookSources) {
  const seen = new Map();

  audiobookSources.forEach((source) => {
    source.items.forEach((item) => {
      const key = `${item.title.toLowerCase()}::${(item.author || "").toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
        return;
      }

      const existingScore =
        (existing.description?.length || 0) +
        (existing.duration ? 20 : 0) +
        (existing.publishedAt ? 10 : 0);
      const nextScore =
        (item.description?.length || 0) +
        (item.duration ? 20 : 0) +
        (item.publishedAt ? 10 : 0);

      seen.set(
        key,
        nextScore > existingScore
          ? { ...item, genres: [...new Set([...(existing.genres || []), ...(item.genres || [])])] }
          : { ...existing, genres: [...new Set([...(existing.genres || []), ...(item.genres || [])])] }
      );
    });
  });

  return [...seen.values()].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title, "de");
  });
}

export function AudioScreen({ loadAudioAction }) {
  const { t, localeTag } = useAppState();
  const fallbackData = React.useMemo(() => buildFallbackData(t), [t]);
  const [data, setData] = React.useState(fallbackData);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("radio");
  const [selectedProgramId, setSelectedProgramId] = React.useState("");
  const [selectedBookFilterId, setSelectedBookFilterId] = React.useState(BOOK_FILTER_ALL);
  const [selectedId, setSelectedId] = React.useState(fallbackData.radioStations[0].id);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackError, setPlaybackError] = React.useState("");
  const [isBuffering, setIsBuffering] = React.useState(false);
  const audioRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    loadAudioAction()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setSelectedProgramId((current) => current || result.audioPrograms[0]?.id || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            ...fallbackData,
            error: t("audio.playback.loadError"),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadAudioAction, fallbackData, t]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    function syncTime() {
      setCurrentTime(audio.currentTime || 0);
    }

    function syncDuration() {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    }

    function handlePlay() {
      setIsPlaying(true);
      setIsBuffering(false);
      setPlaybackError("");
    }

    function handlePause() {
      setIsPlaying(false);
      setIsBuffering(false);
    }

    function handleWaiting() {
      setIsBuffering(true);
    }

    function handlePlaying() {
      setIsBuffering(false);
    }

    function handleEnded() {
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
    }

    function handleError() {
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackError(t("audio.playback.retry"));
    }

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [t]);

  const selectedProgram =
    data.audioPrograms.find((program) => program.id === selectedProgramId) || data.audioPrograms[0] || null;
  const allBooks = React.useMemo(() => mergeBookLibrary(data.audiobookSources), [data.audiobookSources]);
  const visibleBookFilters = React.useMemo(
    () =>
      AUDIOBOOK_GENRES.filter(
        (filter) => filter.id === BOOK_FILTER_ALL || allBooks.some((item) => item.genres.includes(filter.id))
      ),
    [allBooks]
  );
  const activeBookFilterId =
    selectedBookFilterId === BOOK_FILTER_ALL || allBooks.some((item) => item.genres.includes(selectedBookFilterId))
      ? selectedBookFilterId
      : BOOK_FILTER_ALL;
  const visibleBooks = React.useMemo(() => {
    if (activeBookFilterId === BOOK_FILTER_ALL) return allBooks;
    return allBooks.filter((item) => item.genres.includes(activeBookFilterId));
  }, [activeBookFilterId, allBooks]);

  const playableItems = React.useMemo(() => {
    const programItems = data.audioPrograms.flatMap((program) =>
      program.episodes.map((episode) => ({
        ...episode,
        section: "audio",
        contextTitle: program.title,
      }))
    );

    const bookItems = data.audiobookSources.flatMap((source) =>
      source.items.map((item) => ({
        ...item,
        section: "book",
        contextTitle: t("audio.tabs.books"),
      }))
    );

    return [...data.radioStations, ...programItems, ...bookItems];
  }, [data, t]);

  const player = playableItems.find((item) => item.id === selectedId) || data.radioStations[0] || null;
  const isOnDemand = player?.section === "audio" || player?.section === "book";

  function startPlayback(item) {
    const audio = audioRef.current;
    if (!item?.url || !audio) {
      setPlaybackError(t("audio.playback.missing"));
      return;
    }

    setSelectedId(item.id);
    setPlaybackError("");
    setCurrentTime(0);
    setDuration(0);

    audio.pause();
    audio.src = item.url;
    audio.load();

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setPlaybackError(t("audio.playback.retry"));
        setIsPlaying(false);
      });
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !player?.url) {
      setPlaybackError(t("audio.playback.missing"));
      return;
    }

    setPlaybackError("");

    if (!audio.src || audio.src !== player.url) {
      audio.src = player.url;
      audio.load();
    }

    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => setPlaybackError(t("audio.playback.retry")));
      }
      return;
    }

    audio.pause();
  }

  function stopPlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    if (isOnDemand) {
      audio.currentTime = 0;
      setCurrentTime(0);
    } else {
      audio.removeAttribute("src");
      audio.load();
    }
    setIsPlaying(false);
    setIsBuffering(false);
  }

  function seekTo(event) {
    const audio = audioRef.current;
    if (!audio || !isOnDemand || !duration) return;

    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const nowTitle =
    player?.section === "audio"
      ? player.title
      : player?.section === "book"
        ? player.title
        : player?.title || t("common.noSelection");

  const nowMeta =
    player?.section === "radio"
      ? t("common.liveRadio")
      : [
          player?.author,
          player?.section === "audio" ? player?.contextTitle : null,
          player?.subtitle,
          player?.duration,
          formatDate(player?.publishedAt, localeTag),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className={`${styles.scope} app`}>
      <div className="app-body">
        <div className="audio-shell">
          <div className="audio-sticky-stack">
            <div className="audio-page-header">
              <h1 className="app-title">{t("audio.title")}</h1>

              <div className="audio-tabs" role="tablist" aria-label={t("audio.title")}>
                {TABS.map((tab) => (
                  <TabButton
                    key={tab.id}
                    label={t(`audio.tabs.${tab.key}`)}
                    icon={tab.icon}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>
            </div>

            <section className="audio-now-bar" aria-labelledby="audio-now-playing">
              <div className="audio-now-main">
                <div className="audio-now-label" id="audio-now-playing">
                  {t("audio.nowPlaying")}
                </div>
                <div className="audio-now-title">{nowTitle}</div>
                <div className="audio-now-meta">{nowMeta}</div>
              </div>

              <div className="audio-now-controls">
                <button className="audio-control audio-control--primary" onClick={togglePlayback} disabled={!player?.url}>
                  {isPlaying ? <Pause size={22} strokeWidth={2.5} /> : <Play size={22} strokeWidth={2.5} />}
                  <span>{isPlaying ? t("common.pause") : t("common.play")}</span>
                </button>
                <button className="audio-control" onClick={stopPlayback} disabled={!player?.url}>
                  <Square size={18} strokeWidth={2.5} />
                  <span>{t("common.stop")}</span>
                </button>
              </div>

              {isOnDemand ? (
                <div className="audio-progress">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="1"
                    value={Math.min(currentTime, duration || 0)}
                    onChange={seekTo}
                    disabled={!duration}
                    aria-label={t("audio.nowPlaying")}
                  />
                  <span>{formatTime(duration)}</span>
                </div>
              ) : null}

              <audio ref={audioRef} className="audio-player-element" preload="none" />

              {(loading || isBuffering || playbackError) ? (
                <div className="audio-player-status">
                  {loading
                    ? t("audio.playback.loading")
                    : isBuffering
                      ? t("audio.playback.buffering")
                      : playbackError}
                </div>
              ) : null}
            </section>
          </div>

          <div className="audio-content">
            {data.error ? <div className="audio-warning">{data.error}</div> : null}

            {activeTab === "radio" ? (
              <section className="audio-panel">
                <div className="audio-panel-head">
                  <h2>{t("audio.tabs.radio")}</h2>
                </div>

                <div className="audio-choice-grid">
                  {data.radioStations.map((station) => (
                    <RadioCard
                      key={station.id}
                      station={station}
                      active={selectedId === station.id}
                      onSelect={startPlayback}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === "programs" ? (
              <section className="audio-panel">
                <div className="audio-panel-head">
                  <h2>{t("audio.tabs.programs")}</h2>
                </div>

                <div className="audio-filter-row" role="tablist" aria-label={t("audio.tabs.programs")}>
                  {data.audioPrograms.map((program) => (
                    <button
                      key={program.id}
                      className={`audio-filter-pill ${selectedProgram?.id === program.id ? "active" : ""}`}
                      onClick={() => setSelectedProgramId(program.id)}
                      aria-pressed={selectedProgram?.id === program.id}
                    >
                      {program.title}
                    </button>
                  ))}
                </div>

                {selectedProgram ? (
                  <>
                    <div className="audio-selection-header">
                      <h3>{selectedProgram.title}</h3>
                      <p>{selectedProgram.description}</p>
                    </div>

                    <div className="audio-media-grid">
                      {selectedProgram.episodes.map((episode) => (
                        <MediaCard
                          key={episode.id}
                          item={episode}
                          active={selectedId === episode.id}
                          localeTag={localeTag}
                          onSelect={(item) =>
                            startPlayback({
                              ...item,
                              section: "audio",
                              contextTitle: selectedProgram.title,
                            })
                          }
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="audio-empty">{t("audio.playback.noPrograms")}</div>
                )}
              </section>
            ) : null}

            {activeTab === "books" ? (
              <section className="audio-panel">
                <div className="audio-panel-head">
                  <h2>{t("audio.tabs.books")}</h2>
                </div>

                <div className="audio-filter-row" role="tablist" aria-label={t("audio.tabs.books")}>
                  {visibleBookFilters.map((filter) => (
                    <button
                      key={filter.id}
                      className={`audio-filter-pill ${activeBookFilterId === filter.id ? "active" : ""}`}
                      onClick={() => setSelectedBookFilterId(filter.id)}
                      aria-pressed={activeBookFilterId === filter.id}
                    >
                      {t(`audio.genres.${filter.id}`)}
                    </button>
                  ))}
                </div>

                {allBooks.length > 0 ? (
                  <>
                    <div className="audio-selection-header">
                      <h3>{t("audio.tabs.books")}</h3>
                      <p>{t(`audio.genreDescriptions.${activeBookFilterId}`) || t("audio.genreDescriptions.all")}</p>
                    </div>

                    {visibleBooks.length > 0 ? (
                      <div className="audio-media-grid">
                        {visibleBooks.map((item) => (
                          <MediaCard
                            key={item.id}
                            item={item}
                            active={selectedId === item.id}
                            localeTag={localeTag}
                            onSelect={(book) =>
                              startPlayback({
                                ...book,
                                section: "book",
                                contextTitle: t("audio.tabs.books"),
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="audio-empty">{t("audio.playback.noBooksForFilter")}</div>
                    )}
                  </>
                ) : (
                  <div className="audio-empty">{t("audio.playback.noBooks")}</div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
