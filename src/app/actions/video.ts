"use server";

const REQUEST_TIMEOUT_MS = 12000;

const SRF_SHOWS = [
  {
    id: "ff969c14-c5a7-44ab-ab72-14d4c9e427a9",
    title: "Tagesschau",
  },
  {
    id: "b7705a5d-4b68-4cb1-9404-03932cd8d569",
    title: "Sternstunde Philosophie",
  },
  {
    id: "1451cc43-0b57-4aa2-9700-0bde073a8e25",
    title: "Sternstunde Religion",
  },
  {
    id: "c5834132-ad10-0001-59f5-b198602011b3",
    title: "Sternstunde Musik",
  },
  {
    id: "3b016ffc-afa2-466d-a694-c48b7ffe1783",
    title: "DOK",
  },
  {
    id: "18477e06-560d-4305-85f0-fd397d43ad1c",
    title: "Reporter",
  },
  {
    id: "709898cb-2dba-45da-8e21-b1f416c39dc9",
    title: "Puls",
  },
  {
    id: "f005a0da-25ea-43a5-b3f8-4c5c23b190b3",
    title: "Einstein",
  },
  {
    id: "d70e9bb9-0cee-46b6-8d87-7cbd8317a9c7",
    title: "Kulturplatz",
  },
  {
    id: "cb28dd84-f0c8-4024-8f20-1a29f5a4ceb7",
    title: "Schweiz aktuell",
  },
  {
    id: "7b49bab9-4981-42ac-8d7e-6ee0304094ca",
    title: "SRF bi de Lüt – Heimweh",
  },
] as const;

const TED_FEED_URL = "https://feeds.feedburner.com/tedtalks_video";

export interface VideoEpisode {
  id: string;
  title: string;
  publishedAt: string;
  streamUrl: string;
  playUrl: string;
  imageUrl: string | null;
  source: "srf" | "ted";
  duration?: string;
}

export interface VideoSection {
  showId: string;
  title: string;
  episodes: VideoEpisode[];
  source: "srf" | "ted";
}

export interface VideoResult {
  sections: VideoSection[];
  error?: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(value: string): string {
  return decodeEntities((value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripCdata(match[1].trim()) : "";
}

function makeHttps(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

function formatTedDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return raw;
}

async function fetchRemoteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "SeniorNett/0.1 (+https://seniornett.local)",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
        Accept: "application/json,text/xml,application/rss+xml,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return "";
    }

    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePodcastFeedUrl(showId: string): Promise<string | null> {
  const showMetaText = await fetchRemoteText(
    `https://il.srgssr.ch/integrationlayer/2.0/srf/show/tv/${showId}.json`
  );
  if (!showMetaText) {
    return null;
  }

  try {
    const showMeta = JSON.parse(showMetaText) as { podcastFeedHdUrl?: string };
    return showMeta.podcastFeedHdUrl || null;
  } catch {
    return null;
  }
}

function parseEpisodesFromFeed(xmlText: string, limit = 8): VideoEpisode[] {
  const itemBlocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return itemBlocks
    .slice(0, limit)
    .map((item) => {
      const id = stripHtml(extractTag(item, "guid"));
      const title = stripHtml(extractTag(item, "title"));
      const pubDateRaw = stripHtml(extractTag(item, "pubDate"));
      const date = pubDateRaw ? new Date(pubDateRaw) : null;
      const publishedAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();

      const mediaCompositionUrn = id ? `urn:srf:video:${id}` : "";
      const playUrl = mediaCompositionUrn
        ? `https://www.srf.ch/play/tv?urn=${encodeURIComponent(mediaCompositionUrn)}`
        : "";

      const imageMatch = item.match(/<itunes:image[^>]+href=["']([^"']+)["'][^>]*>/i);
      const imageUrl = imageMatch ? decodeEntities(imageMatch[1]) : null;

      return {
        id,
        title: title || "Sendung",
        publishedAt,
        streamUrl: "",
        playUrl,
        imageUrl,
        source: "srf" as const,
      } satisfies VideoEpisode;
    })
    .filter((episode) => episode.id && episode.playUrl);
}

async function loadSrfShowEpisodes(showId: string): Promise<VideoEpisode[]> {
  const feedUrl = await resolvePodcastFeedUrl(showId);
  if (!feedUrl) {
    return [];
  }

  const xmlText = await fetchRemoteText(feedUrl);
  if (!xmlText) {
    return [];
  }

  const feedEpisodes = parseEpisodesFromFeed(xmlText, 10);

  // Enrich with reliable thumbnails and canonical episode titles from mediaComposition.
  const enriched = await Promise.all(
    feedEpisodes.map(async (episode) => {
      const mediaMetaText = await fetchRemoteText(
        `https://il.srgssr.ch/integrationlayer/2.0/mediaComposition/byUrn/urn:srf:video:${episode.id}.json`
      );
      if (!mediaMetaText) {
        return episode;
      }

      try {
        const mediaMeta = JSON.parse(mediaMetaText) as {
          chapterList?: Array<{
            title?: string;
            imageUrl?: string;
            podcastHdUrl?: string;
            podcastSdUrl?: string;
            resourceList?: Array<{ mimeType?: string; url?: string }>;
          }>;
        };
        const chapter = mediaMeta.chapterList?.[0];
        const mp4FromResource =
          chapter?.resourceList?.find((resource) =>
            (resource.mimeType || "").toLowerCase().includes("video/mp4")
          )?.url || "";

        const streamUrl =
          makeHttps(chapter?.podcastHdUrl) ||
          makeHttps(chapter?.podcastSdUrl) ||
          makeHttps(mp4FromResource) ||
          episode.streamUrl;

        return {
          ...episode,
          title: chapter?.title || episode.title,
          imageUrl: chapter?.imageUrl || episode.imageUrl,
          streamUrl,
        };
      } catch {
        return episode;
      }
    })
  );

  return enriched.slice(0, 8);
}

async function loadTedEpisodes(): Promise<VideoEpisode[]> {
  const xmlText = await fetchRemoteText(TED_FEED_URL);
  if (!xmlText) return [];

  const itemBlocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return itemBlocks
    .slice(0, 10)
    .map((item) => {
      const title = stripHtml(extractTag(item, "title"));
      const pubDateRaw = stripHtml(extractTag(item, "pubDate"));
      const date = pubDateRaw ? new Date(pubDateRaw) : null;
      const publishedAt =
        date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();

      const enclosureMatch = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*/i);
      const streamUrl = enclosureMatch ? makeHttps(decodeEntities(enclosureMatch[1])) : "";

      const thumbMatch =
        item.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*height=["']360["'][^>]*/i) ||
        item.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*/i);
      const imageUrl = thumbMatch ? decodeEntities(thumbMatch[1]) : null;

      const durationRaw = stripHtml(extractTag(item, "itunes:duration"));
      const duration = formatTedDuration(durationRaw);

      const linkMatch = item.match(/<link>([^<]+)<\/link>/i);
      const playUrl = linkMatch ? linkMatch[1].trim() : "";

      const id = stripHtml(extractTag(item, "guid")) || `ted-${publishedAt}`;

      return {
        id,
        title: title || "TED Talk",
        publishedAt,
        streamUrl,
        playUrl,
        imageUrl,
        source: "ted" as const,
        duration,
      } satisfies VideoEpisode;
    })
    .filter((ep) => ep.streamUrl || ep.playUrl);
}

export async function loadVideoAction(): Promise<VideoResult> {
  try {
    const [srfResults, tedEpisodes] = await Promise.all([
      Promise.all(
        SRF_SHOWS.map(async (show) => ({
          showId: show.id,
          title: show.title,
          episodes: await loadSrfShowEpisodes(show.id),
          source: "srf" as const,
        }))
      ),
      loadTedEpisodes(),
    ]);

    const sections: VideoSection[] = [
      ...srfResults,
      {
        showId: "ted-talks",
        title: "TED Talks",
        episodes: tedEpisodes,
        source: "ted" as const,
      },
    ];

    return { sections };
  } catch {
    return {
      sections: [],
      error: "Inhalte konnten nicht geladen werden.",
    };
  }
}
