import { unstable_cache } from "next/cache";
import { AUDIOBOOK_GENRES } from "./genres";

const REQUEST_TIMEOUT_MS = 12000;
const CATALOG_REVALIDATE_SECONDS = 600;
const PROGRAM_EPISODE_LIMIT = 12;
const SRF_BOOK_LIMIT = 24;
const ARD_BOOK_LIMIT = 70;
const LIBRIVOX_BOOK_LIMIT = 12;
const VORLESER_BOOK_LIMIT = 80;
const VORLESER_SITEMAP_INDEX_URL = "https://www.vorleser.net/sitemap.xml";

const RADIO_STATIONS = [
  {
    id: "radio-swiss-pop",
    title: "Radio Swiss Pop",
    description: "Ruhige Popmusik ohne Unterbruch.",
    url: "https://stream.srg-ssr.ch/srgssr/rsp/mp3/128",
  },
  {
    id: "radio-swiss-jazz",
    title: "Radio Swiss Jazz",
    description: "Jazz, Soul und entspannte Klassiker.",
    url: "https://stream.srg-ssr.ch/srgssr/rsj/mp3/128",
  },
  {
    id: "radio-swiss-classic",
    title: "Radio Swiss Classic",
    description: "Klassische Musik fuer ruhige Momente.",
    url: "https://stream.srg-ssr.ch/srgssr/rsc_de/mp3/128",
  },
  {
    id: "radio-1",
    title: "SRF 1",
    description: "Alltag, Gesellschaft und Schweizer Geschichten.",
    url: "https://stream.srg-ssr.ch/srgssr/srf1/mp3/128",
  },
  {
    id: "radio-2-kultur",
    title: "SRF 2 Kultur",
    description: "Kultur, Wissen und ruhige Wortbeitraege.",
    url: "https://stream.srg-ssr.ch/srgssr/srf2/mp3/128",
  },
  {
    id: "radio-3",
    title: "SRF 3",
    description: "Musik, Unterhaltung und Tagesbegleitung.",
    url: "https://stream.srg-ssr.ch/srgssr/srf3/mp3/128",
  },
  {
    id: "radio-4-news",
    title: "SRF 4 News",
    description: "Nachrichten und Hintergruende laufend.",
    url: "https://stream.srg-ssr.ch/srgssr/srf4news/mp3/128",
  },
  {
    id: "radio-musikwelle",
    title: "Musikwelle",
    description: "Volksmusik, Schlager und vertraute Klaenge.",
    url: "https://stream.srg-ssr.ch/srgssr/srfmw/mp3/128",
  },
] as const;

const AUDIO_SHOWS = [
  {
    id: "audio-news",
    title: "Nachrichten",
    description: "Die aktuelle Nachrichtenuebersicht zum Nachhoeren.",
    showId: "4d8995b0-8492-4e6c-b97d-1030781d815f",
  },
  {
    id: "audio-echo-der-zeit",
    title: "Echo der Zeit",
    description: "Vertiefung und Einordnung zum Tagesgeschehen.",
    showId: "28549e81-c453-4671-92ad-cb28796d06a8",
  },
  {
    id: "audio-meeting-point",
    title: "Meeting point",
    description: "Gespraeche und Geschichten aus dem Alltag.",
    showId: "d2169ee6-574c-4360-b705-2913fad14603",
  },
  {
    id: "audio-tagesgespraech",
    title: "Tagesgespräch",
    description: "Ein Thema des Tages in Ruhe besprochen.",
    showId: "26340aaf-8008-4b39-9b57-2fe71bc4f16a",
  },
] as const;

const SRF_BOOK_SHOW = {
  id: "books_srf",
  title: "SRF Audio",
  description: "Hörspiele und Erzählstoffe aus der Schweiz.",
  showId: "553f3450-1697-4fc5-ad79-0dead1605c8f",
} as const;

const LIBRIVOX_GERMAN_PAGES = [
  "https://librivox.org/unterhaltungen-deutscher-ausgewanderten-by-goethe/",
  "https://librivox.org/sammlung-kurzer-deutschsprachiger-texte-008-by-various/",
  "https://librivox.org/sammlung-kurzer-deutscher-prosa-042-by-various/",
  "https://librivox.org/sammlung-kurzer-deutschsprachiger-texte-006-by-various/",
  "https://librivox.org/sammlung-kurzer-deutscher-prosa-015-by-various/",
  "https://librivox.org/sammlung-deutscher-gedichte-008-by-various/",
  "https://librivox.org/sammlung-kurzer-deutscher-prosa-031-by-various/",
  "https://librivox.org/sammlung-kurzer-deutscher-prosa-019-by-various/",
] as const;

const AUDIOBOOK_SOURCE_LABELS = {
  books_librivox: {
    title: "LibriVox",
    description: "Freie Klassiker mit direkter Wiedergabe im Geraet.",
  },
  books_vorleser: {
    title: "vorleser.net",
    description: "Deutschsprachige Hoerbuecher und Lesungen.",
  },
  books_ard: {
    title: "ARD Audiothek",
    description: "Lange Hoerspiele und Literaturproduktionen.",
  },
  books_srf: {
    title: "SRF Audio",
    description: "Hoerspiele und Erzaehlstoffe aus der Schweiz.",
  },
} as const;

export interface RadioStation {
  id: string;
  title: string;
  description: string;
  section: "radio";
  url: string;
  meta: string;
}

export interface AudioEpisode {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: string;
  publishedAt: string;
}

export interface AudioProgram {
  id: string;
  title: string;
  description: string;
  episodes: AudioEpisode[];
}

export interface AudiobookItem {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: string;
  publishedAt?: string;
  author?: string;
  genres: string[];
  sourceId: string;
}

export interface AudiobookSource {
  id: string;
  title: string;
  description: string;
  items: AudiobookItem[];
}

export interface AudioResult {
  radioStations: RadioStation[];
  audioPrograms: AudioProgram[];
  audiobookSources: AudiobookSource[];
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

function compactText(value: string, limit = 180): string {
  const clean = stripHtml(value);
  if (!clean) return "";
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trimEnd()}…`;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&amp;/g, "&");
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

function formatDuration(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  if (/^\d+$/.test(trimmed)) {
    return formatDurationFromSeconds(Number(trimmed));
  }

  return trimmed;
}

function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatIsoDuration(value: string): string {
  const match = value.match(/T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return "";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return formatDurationFromSeconds((hours * 3600) + (minutes * 60) + seconds);
}

function stripAuthorLifespan(value: string): string {
  return value.replace(/\(\d{3,4}\s*-\s*\d{0,4}\)/g, "").replace(/\s+/g, " ").trim();
}

function parseAuthorFromTitle(value: string): { title: string; author: string } {
  const clean = value.trim();
  let match = clean.match(/^(.+?)\s+von\s+(.+)$/i);
  if (match) return { title: match[1].trim(), author: match[2].trim() };

  match = clean.match(/^(.+?):\s+(.+)$/);
  if (match) return { title: match[2].trim(), author: match[1].trim() };

  match = clean.match(/^(.+?)\s+by\s+(.+)$/i);
  if (match) return { title: match[1].trim(), author: match[2].trim() };

  return { title: clean, author: "" };
}

function normalizeGenres(input: string[]): string[] {
  const unique = [...new Set(input.filter(Boolean))];
  return unique.length > 0 ? unique : ["romane"];
}

function inferGenresFromText(...values: Array<string | undefined>): string[] {
  const lower = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const genres: string[] = [];

  if (/(märchen|maerchen|kinder|jugend|weihnacht|fabel|tiergeschichte)/.test(lower)) genres.push("kinder");
  if (/(krimi|mord|thriller|detektiv|spannung|geheimnis|gespenst|verbrechen|schauer)/.test(lower)) genres.push("spannung");
  if (/(hörspiel|hoerspiel|szenen|dialog|theater|drama|inszenierung|bühne|buehne)/.test(lower)) genres.push("hoerspiele");
  if (/(gedicht|lyrik|texte|prosa|novelle|novellen|erzählung|erzaehlung|geschichten|sammlung)/.test(lower)) genres.push("kurztexte");
  if (/(roman|klassiker|erzählung|erzaehlung|geschichte)/.test(lower)) genres.push("romane");

  return normalizeGenres(genres);
}

function inferLibrivoxGenres(title: string, description: string): string[] {
  const lower = `${title} ${description}`.toLowerCase();
  if (lower.includes("gedichte")) return ["kurztexte"];
  if (lower.includes("prosa") || lower.includes("texte")) return ["kurztexte", "romane"];
  return inferGenresFromText(title, description);
}

function mapVorleserGenres(categoryText: string): string[] {
  return inferGenresFromText(categoryText);
}

function mergeGenres(...genreLists: string[][]): string[] {
  return normalizeGenres(genreLists.flat());
}

function filterKnownGenres(items: AudiobookItem[]): AudiobookItem[] {
  const knownGenres = new Set<string>(AUDIOBOOK_GENRES.map((genre) => genre.id));

  return items.map((item) => ({
    ...item,
    genres: normalizeGenres(item.genres.filter((genre) => knownGenres.has(genre))),
  }));
}

function sortBooks(items: AudiobookItem[]): AudiobookItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title, "de");
  });
}

function dedupeSourceItems(items: AudiobookItem[]): AudiobookItem[] {
  const seen = new Map<string, AudiobookItem>();

  for (const item of items) {
    const key = `${item.title.toLowerCase()}::${(item.author || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }

    const existingScore = (existing.description?.length || 0) + (existing.duration ? 20 : 0) + (existing.author ? 20 : 0);
    const nextScore = (item.description?.length || 0) + (item.duration ? 20 : 0) + (item.author ? 20 : 0);

    seen.set(
      key,
      nextScore > existingScore
        ? { ...item, genres: mergeGenres(existing.genres, item.genres) }
        : { ...existing, genres: mergeGenres(existing.genres, item.genres) }
    );
  }

  return [...seen.values()];
}

async function fetchRemoteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "force-cache",
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
      redirect: "follow",
      headers: {
        "User-Agent": "SeniorNett/0.1 (+https://seniornett.local)",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
        Accept: "application/json,text/xml,application/rss+xml,text/html,*/*;q=0.8",
      },
    });

    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePodcastFeed(showId: string): Promise<{ feedUrl: string; fallbackDescription: string } | null> {
  const metaText = await fetchRemoteText(
    `https://il.srgssr.ch/integrationlayer/2.0/srf/show/radio/${showId}.json`
  );
  if (!metaText) return null;

  try {
    const meta = JSON.parse(metaText) as {
      podcastFeedHdUrl?: string;
      podcastFeedSdUrl?: string;
      description?: string;
      lead?: string;
    };
    const feedUrl = meta.podcastFeedHdUrl || meta.podcastFeedSdUrl || "";
    if (!feedUrl) return null;
    return { feedUrl, fallbackDescription: meta.description || meta.lead || "" };
  } catch {
    return null;
  }
}

async function resolveVorleserProductsSitemapUrl(): Promise<string> {
  const indexXml = await fetchRemoteText(VORLESER_SITEMAP_INDEX_URL);
  const match = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((entry) => decodeXmlEntities(entry[1]))
    .find((url) => url.includes("sitemap=products"));

  return match || "";
}

function parseEpisodes(xmlText: string, limit: number): AudioEpisode[] {
  const itemBlocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return itemBlocks
    .slice(0, limit)
    .map((itemBlock) => {
      const guid = stripHtml(extractTag(itemBlock, "guid")) || "";
      const title = stripHtml(extractTag(itemBlock, "title")) || "Folge";
      const description = compactText(extractTag(itemBlock, "description"), 220);
      const pubDateRaw = stripHtml(extractTag(itemBlock, "pubDate"));
      const duration = formatDuration(stripHtml(extractTag(itemBlock, "itunes:duration")));
      const enclosureUrl =
        itemBlock.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1] ||
        itemBlock.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1] ||
        "";
      const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null;
      const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : "";

      return {
        id: guid || title,
        title,
        description,
        url: makeHttps(enclosureUrl),
        duration,
        publishedAt,
      };
    })
    .filter((episode) => episode.url);
}

async function loadAudioShow(show: { id: string; title: string; description: string; showId: string }): Promise<AudioProgram> {
  const meta = await resolvePodcastFeed(show.showId);
  if (!meta) {
    return { id: show.id, title: show.title, description: show.description, episodes: [] };
  }

  const xmlText = await fetchRemoteText(meta.feedUrl);
  return {
    id: show.id,
    title: show.title,
    description: compactText(meta.fallbackDescription || show.description, 110),
    episodes: xmlText ? parseEpisodes(xmlText, PROGRAM_EPISODE_LIMIT) : [],
  };
}

function parseLibrivoxRssId(pageHtml: string): string {
  return pageHtml.match(/https:\/\/librivox\.org\/rss\/(\d+)/i)?.[1] || "";
}

async function loadLibrivoxSource(): Promise<AudiobookSource> {
  const items = await Promise.all(
    LIBRIVOX_GERMAN_PAGES.slice(0, LIBRIVOX_BOOK_LIMIT).map(async (link) => {
      const pageHtml = await fetchRemoteText(link);
      if (!pageHtml) return null;

      const rssId = parseLibrivoxRssId(pageHtml);
      if (!rssId) return null;

      const title = compactText(stripHtml(pageHtml.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] || "LibriVox"), 96);
      const author = stripAuthorLifespan(
        stripHtml(pageHtml.match(/<p class="book-page-author">([\s\S]*?)<\/p>/i)?.[1] || "")
      );
      const description = compactText(pageHtml.match(/<p class="description">([\s\S]*?)<\/p>/i)?.[1] || "", 180);
      const catalogDate = stripHtml(pageHtml.match(/Catalog date:<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1] || "");
      const parsedDate = catalogDate ? new Date(catalogDate) : null;
      const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : "";

      const bookRss = await fetchRemoteText(`https://librivox.org/rss/${rssId}`);
      const firstEpisode = parseEpisodes(bookRss, 1)[0];
      if (!firstEpisode) return null;

      return {
        id: `books_librivox_${rssId}`,
        title,
        description,
        url: firstEpisode.url,
        duration: firstEpisode.duration,
        publishedAt,
        author: author || "Verschiedene",
        genres: inferLibrivoxGenres(title, description),
        sourceId: "books_librivox",
      } satisfies AudiobookItem;
    })
  );

  return {
    id: "books_librivox",
    title: AUDIOBOOK_SOURCE_LABELS.books_librivox.title,
    description: AUDIOBOOK_SOURCE_LABELS.books_librivox.description,
    items: sortBooks(dedupeSourceItems(filterKnownGenres(items.filter(Boolean) as AudiobookItem[]))),
  };
}

async function loadVorleserSource(): Promise<AudiobookSource> {
  const sitemapUrl = await resolveVorleserProductsSitemapUrl();
  const sitemapXml = sitemapUrl ? await fetchRemoteText(sitemapUrl) : "";
  const pagePaths = [
    ...new Set(
      [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((match) => decodeXmlEntities(match[1]))
        .filter((url) => url.includes("/hoerbuch/"))
        .map((url) => url.replace("https://www.vorleser.net", ""))
    ),
  ].slice(0, VORLESER_BOOK_LIMIT);

  const items = await Promise.all(
    pagePaths.map(async (path) => {
      const detailHtml = await fetchRemoteText(`https://www.vorleser.net${path}`);
      if (!detailHtml) return null;

      const schemaText = detailHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] || "";
      let title = "";
      let duration = "";
      try {
        const schema = JSON.parse(schemaText) as { name?: string; duration?: string };
        title = schema.name || "";
        duration = formatIsoDuration(schema.duration || "");
      } catch {
        title = "";
      }

      const description =
        compactText(detailHtml.match(/<h2 class="title">Beschreibung<\/h2><p>([\s\S]*?)<\/p>/i)?.[1] || "", 180) ||
        "Kostenloses Hoerbuch von vorleser.net.";
      const author = stripHtml(
        detailHtml.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]{0,500}?<[^>]+>([A-ZÄÖÜ][^<]{2,120})<\/[^>]+>/i)?.[1] || ""
      );
      const categories = stripHtml(detailHtml.match(/<dt>.*?Kategorien<\/dt><dd>([\s\S]*?)<\/dd>/i)?.[1] || "");
      const downloadPath = detailHtml.match(/href="(\/hoerbuch\/download\/[^"]+)"/i)?.[1] || "";
      if (!downloadPath) return null;

      return {
        id: `books_vorleser_${path.replace(/[^a-z0-9]+/gi, "_")}`,
        title: title || path.split("/").pop() || "Hörbuch",
        description,
        url: `https://www.vorleser.net${downloadPath}`,
        duration,
        author,
        genres: mergeGenres(mapVorleserGenres(categories), inferGenresFromText(title, description, categories)),
        sourceId: "books_vorleser",
      } satisfies AudiobookItem;
    })
  );

  return {
    id: "books_vorleser",
    title: AUDIOBOOK_SOURCE_LABELS.books_vorleser.title,
    description: AUDIOBOOK_SOURCE_LABELS.books_vorleser.description,
    items: sortBooks(dedupeSourceItems(filterKnownGenres(items.filter(Boolean) as AudiobookItem[]))),
  };
}

async function loadArdSource(): Promise<AudiobookSource> {
  const html = await fetchRemoteText("https://www.ardaudiothek.de/sammlung/bestseller-als-hoerspiel/9320456/");
  const nextDataText =
    html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i)?.[1] || "";

  if (!nextDataText) {
    return {
      id: "books_ard",
      title: AUDIOBOOK_SOURCE_LABELS.books_ard.title,
      description: AUDIOBOOK_SOURCE_LABELS.books_ard.description,
      items: [],
    };
  }

  try {
    const nextData = JSON.parse(nextDataText) as {
      props?: {
        pageProps?: {
          initialData?: {
            widgets?: Array<{ teasers?: Array<Record<string, unknown>> }>;
          };
        };
      };
    };

    const teasers =
      nextData.props?.pageProps?.initialData?.widgets?.flatMap((widget) => widget.teasers || []) || [];

    const items = teasers
      .slice(0, ARD_BOOK_LIMIT)
      .map((teaser) => {
        const url = makeHttps(String(teaser.assetDownloadURL || ""));
        if (!url) return null;

        const parsed = parseAuthorFromTitle(String(teaser.title || "ARD Hörspiel"));
        return {
          id: `books_ard_${String(teaser.assetId || teaser.id || teaser.title || Math.random())}`,
          title: compactText(parsed.title || String(teaser.title || "ARD Hörspiel"), 88),
          description: compactText(
            String(
              teaser.longSynopsis ||
              teaser.synopsis ||
              teaser.description ||
              teaser.lead ||
              teaser.imageAlt ||
              "Hörspiel aus der ARD Audiothek."
            ),
            180
          ),
          url,
          duration: formatDurationFromSeconds(Number(teaser.duration || 0)),
          publishedAt: String(teaser.firstPublicationDate || ""),
          author: parsed.author,
          genres: mergeGenres(["hoerspiele"], inferGenresFromText(parsed.title, parsed.author, String(teaser.synopsis || teaser.longSynopsis || teaser.description || ""))),
          sourceId: "books_ard",
        } satisfies AudiobookItem;
      })
      .filter(Boolean) as AudiobookItem[];

    return {
      id: "books_ard",
      title: AUDIOBOOK_SOURCE_LABELS.books_ard.title,
      description: AUDIOBOOK_SOURCE_LABELS.books_ard.description,
      items: sortBooks(dedupeSourceItems(filterKnownGenres(items))),
    };
  } catch {
    return {
      id: "books_ard",
      title: AUDIOBOOK_SOURCE_LABELS.books_ard.title,
      description: AUDIOBOOK_SOURCE_LABELS.books_ard.description,
      items: [],
    };
  }
}

async function loadSrfBooksSource(): Promise<AudiobookSource> {
  const program = await loadAudioShow(SRF_BOOK_SHOW);
  return {
    id: "books_srf",
    title: AUDIOBOOK_SOURCE_LABELS.books_srf.title,
    description: AUDIOBOOK_SOURCE_LABELS.books_srf.description,
    items: sortBooks(
      filterKnownGenres(
        program.episodes.slice(0, SRF_BOOK_LIMIT).map((episode) => {
          const parsed = parseAuthorFromTitle(episode.title);
          return {
            id: `books_srf_${episode.id}`,
            title: parsed.title,
            description: episode.description,
            url: episode.url,
            duration: episode.duration,
            publishedAt: episode.publishedAt,
            author: parsed.author,
            genres: mergeGenres(["hoerspiele"], inferGenresFromText(parsed.title, parsed.author, episode.description)),
            sourceId: "books_srf",
          } satisfies AudiobookItem;
        })
      )
    ),
  };
}

const loadAudioCatalogCached = unstable_cache(
  async (): Promise<AudioResult> => {
    const [audioPrograms, audiobookSources] = await Promise.all([
      Promise.all(AUDIO_SHOWS.map((show) => loadAudioShow(show))),
      Promise.all([
        loadLibrivoxSource(),
        loadVorleserSource(),
        loadArdSource(),
        loadSrfBooksSource(),
      ]),
    ]);

    return {
      radioStations: RADIO_STATIONS.map((station) => ({
        ...station,
        section: "radio" as const,
        meta: "Live-Radio",
      })),
      audioPrograms,
      audiobookSources,
      error:
        audioPrograms.some((program) => program.episodes.length === 0) ||
        audiobookSources.some((source) => source.items.length === 0)
          ? "Einzelne Inhalte konnten nicht geladen werden."
          : "",
    };
  },
  ["audio-catalog-v3"],
  { revalidate: CATALOG_REVALIDATE_SECONDS }
);

export async function loadAudioCatalog(): Promise<AudioResult> {
  return loadAudioCatalogCached();
}
