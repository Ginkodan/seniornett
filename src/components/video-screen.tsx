// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import { useAppState } from "./app-provider";
import { AppImage } from "./ui";
import styles from "./video-screen.module.css";

function formatDate(value, localeTag) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(localeTag, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceBadge({ source, t }) {
  return (
    <span className={`video-source-badge video-source-badge--${source}`}>
      {source === "ted" ? t("video.source.ted") : t("video.source.srf")}
    </span>
  );
}

export function VideoScreen({ loadVideoAction }) {
  const { t, locale, localeTag } = useAppState();
  const [data, setData] = React.useState({ sections: [], error: "" });
  const [loading, setLoading] = React.useState(true);
  const [player, setPlayer] = React.useState({
    open: false,
    title: "",
    url: "",
    fallbackUrl: "",
    mode: "iframe",
  });
  const videoRef = React.useRef(null);

  const loadData = React.useCallback(() => {
    setLoading(true);
    return loadVideoAction(locale)
      .then((result) => setData(result))
      .catch(() =>
        setData({
          sections: [],
          error: t("video.error"),
        })
      )
      .finally(() => setLoading(false));
  }, [loadVideoAction, locale, t]);

  React.useEffect(() => {
    // Kick off the initial content load once the screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!player.open) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setPlayer({ open: false, title: "", url: "", fallbackUrl: "", mode: "iframe" });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [player.open]);

  function openPlayer(episode) {
    setPlayer({
      open: true,
      title: episode.title,
      url: episode.streamUrl || episode.playUrl,
      fallbackUrl: episode.playUrl,
      mode: episode.streamUrl ? "video" : "iframe",
    });
  }

  function closePlayer() {
    setPlayer({ open: false, title: "", url: "", fallbackUrl: "", mode: "iframe" });
  }

  const hasSections =
    !loading && !data.error && data.sections && data.sections.some((s) => s.episodes.length > 0);

  return (
    <div className={`${styles.scope} app`}>
      <div className="app-header">
        <h1 className="app-title">{t("video.title")}</h1>
        <div className="spacer" />
        <button className="btn" onClick={loadData} disabled={loading}>
          {loading ? t("video.loading") : t("video.reload")}
        </button>
      </div>

      <div className="app-body">
        <div className="video-shell">
          {data.error && <div className="video-warning">{data.error}</div>}

          {loading && (
            <p className="video-loading">{t("video.loadingEpisodes")}</p>
          )}

          {data.sections && data.sections.map((section) =>
            section.episodes.length === 0 ? null : (
              <section key={section.showId} className="video-section">
                <div className="video-section-header">
                  <h2 className="video-section-title">{section.title}</h2>
                  <SourceBadge source={section.source} t={t} />
                </div>
                <div className="video-episode-list">
                  {section.episodes.map((episode) => (
                    <button
                      key={episode.id}
                      className="video-episode-card"
                      onClick={() => openPlayer(episode)}
                    >
                      <div className="video-episode-image-wrap">
                        {episode.imageUrl ? (
                          <AppImage
                            src={episode.imageUrl}
                            alt={episode.title}
                            className="video-episode-image"
                            fill
                            sizes="(max-width: 900px) 100vw, 20rem"
                          />
                        ) : (
                          <div className="video-episode-image-fallback">
                            {episode.source === "ted" ? t("video.source.ted") : t("video.source.srf")}
                          </div>
                        )}
                      </div>
                      <div className="video-episode-body">
                        <div className="video-episode-title">{episode.title}</div>
                        <div className="video-episode-meta">
                          {episode.source === "ted"
                            ? episode.duration || formatDate(episode.publishedAt, localeTag)
                            : formatDate(episode.publishedAt, localeTag)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          )}

          {!loading && !data.error && !hasSections && (
            <div className="video-warning">
              {t("video.empty")}
            </div>
          )}
        </div>
      </div>

      {player.open && (
        <div className="video-player-overlay" role="dialog" aria-modal="true" aria-label={player.title}>
          <div className="video-player-panel">
            <div className="video-player-head">
              <h3>{player.title}</h3>
              <button className="btn" onClick={closePlayer}>
                {t("video.close")}
              </button>
            </div>
            <div className="video-player-frame-wrap">
              {player.mode === "video" ? (
                <video
                  key={player.url}
                  ref={videoRef}
                  className="video-player-frame"
                  src={player.url}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <iframe
                  title={player.title}
                  src={player.url}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="video-player-frame"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
