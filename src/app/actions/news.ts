"use server";

const REMOTE_FETCH_TIMEOUT_MS = 12000;
const MAX_IMAGE_BYTES = 1_500_000;

const NEWS_SOURCES = [
  { name: "SRF", url: "https://www.srf.ch/news/bnf/rss/1646" },
  { name: "20 Minuten", url: "https://www.20min.ch/rss" },
];

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeEntities((value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function shorten(value: string, maxLength = 220) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function extractTag(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripCdata(match[1].trim()) : "";
}

function extractImage(block: string) {
  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (enclosureMatch) return enclosureMatch[1];

  const mediaMatch = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["'][^>]*\/?>/i);
  if (mediaMatch) return mediaMatch[1];

  const description = extractTag(block, "description");
  const imageMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imageMatch?.[1] || null;
}

function normalizeUrl(rawUrl: string, baseUrl?: string) {
  if (!rawUrl) {
    return null;
  }

  const decodedUrl = decodeEntities(rawUrl.trim());

  if (decodedUrl.startsWith("//")) {
    return `https:${decodedUrl}`;
  }

  try {
    return new URL(decodedUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseFeed(xmlText: string, sourceName: string) {
  const items = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return items
    .slice(0, 8)
    .map((item, index) => {
      const title = stripHtml(extractTag(item, "title"));
      const description = stripHtml(extractTag(item, "description"));
      const link = stripHtml(extractTag(item, "link"));
      const pubDate = stripHtml(extractTag(item, "pubDate"));
      const normalizedLink = normalizeUrl(link);

      return {
        id: `${sourceName}-${index}-${title}`,
        title,
        link: normalizedLink || "",
        summary: shorten(description, 220),
        content: "",
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        image: normalizeUrl(extractImage(item) || "", normalizedLink || sourceName),
        imageDataUrl: null,
      };
    })
    .filter((item) => item.title);
}

function extractMetaDescription(htmlText: string) {
  const metaMatch = htmlText.match(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  return metaMatch ? stripHtml(metaMatch[1]) : "";
}

function extractMetaImage(htmlText: string, baseUrl?: string) {
  const metaMatch = htmlText.match(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );

  return metaMatch ? normalizeUrl(metaMatch[1], baseUrl) : null;
}

function extractParagraphMatches(htmlText: string) {
  const cleanedHtml = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const scopedMatch =
    cleanedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    cleanedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  const searchArea = scopedMatch ? scopedMatch[1] : cleanedHtml;
  const paragraphMatches = Array.from(searchArea.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
  const seen = new Set<string>();

  return paragraphMatches
    .map((match) => stripHtml(match[1]))
    .filter((text) => {
      const normalized = text.toLowerCase();
      if (!text || text.length < 70) return false;
      if (normalized.includes("cookie")) return false;
      if (normalized.includes("newsletter")) return false;
      if (normalized.includes("werbung")) return false;
      if (normalized.includes("abonnieren")) return false;
      return true;
    })
    .filter((text) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, 3);
}

function extractArticleContent(htmlText: string) {
  const paragraphs = extractParagraphMatches(htmlText);
  if (paragraphs.length) {
    return paragraphs.join("\n\n");
  }

  return shorten(extractMetaDescription(htmlText), 420);
}

async function fetchRemoteText(url: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return "";
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return "";
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: abortController.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "SeniorNett/0.1 (+https://seniornett.local)",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
        Accept: "text/html,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
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

async function fetchImageDataUrl(url: string | null) {
  if (!url) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return null;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: abortController.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "SeniorNett/0.1 (+https://seniornett.local)",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer.byteLength || arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadNewsAction() {
  const responses = await Promise.all(
    NEWS_SOURCES.map(async (source) => {
      const xmlText = await fetchRemoteText(source.url);
      if (!xmlText) {
        return [];
      }

      return parseFeed(xmlText, source.name);
    })
  );

  const items = responses
    .flatMap((result) => result)
    .filter((item, index, allItems) => allItems.findIndex((entry) => entry.title === item.title) === index)
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .slice(0, 12);

  if (!items.length) {
    return {
      items: [],
      updatedAt: null,
      error: "unavailable",
    };
  }

  const enrichedItems = await Promise.all(
    items.map(async (article) => {
      if (!article.link) {
        return {
          ...article,
          imageDataUrl: null,
          content: article.summary,
        };
      }

      const htmlText = await fetchRemoteText(article.link);
      const content = htmlText ? extractArticleContent(htmlText) : "";
      const image = htmlText ? extractMetaImage(htmlText, article.link) : null;
      const finalImage = image || article.image;
      const imageDataUrl = await fetchImageDataUrl(finalImage);

      return {
        ...article,
        image: finalImage,
        imageDataUrl,
        content: content || article.summary,
      };
    })
  );

  return {
    items: enrichedItems,
    updatedAt: new Date().toISOString(),
    error: null,
  };
}
