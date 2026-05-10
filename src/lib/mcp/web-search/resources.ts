import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import type { McpLanguage, McpToolObservation } from "../types";
import { _documentLookupTestInternals } from "./document-lookup";
import { _extractTestInternals, extractUsefulInfo, formatExtractedInfo, formatScheduleRows } from "./extract";
import { webSearchPrompt } from "./prompts";
import { buildSearchQuery } from "./query";
import { rankResults, scoreResult } from "./rank";
import { cleanSearchTitle, domainFromUrl, normalizeContentText } from "./text";
import type { WebSearchInput, WebSearchRaw, WebSearchResult } from "./types";
export type { WebSearchExtractedInfo, WebSearchInput, WebSearchIntent, WebSearchRaw, WebSearchResult, WebSearchScheduleRow } from "./types";

const SEARCH_TIMEOUT_MS = 18_000;
const PAGE_TIMEOUT_MS = 12_000;
const MAX_RESULTS = 6;
const MAX_CRAWL_RESULTS = 3;
const MAX_TEXT_CHARS = 10_000;
const MAX_MARKDOWN_CHARS = 18_000;
const PDF_PAGE_LIMIT = 12;

let browserPromise: Promise<Browser> | null = null;
let pdfjsModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
  }

  return browserPromise;
}

function unwrapSearchUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const startpageUrl = parsed.searchParams.get("url") || parsed.searchParams.get("u");
    return startpageUrl ? decodeURIComponent(startpageUrl) : url;
  } catch {
    return url;
  }
}

function isDiscardableSearchResult(result: { title: string; url: string; domain?: string; snippet?: string }): boolean {
  const title = result.title.trim().toLowerCase();
  const url = result.url.trim().toLowerCase();
  const domain = (result.domain || "").trim().toLowerCase();
  const snippet = (result.snippet || "").trim().toLowerCase();

  if (!title || !url) return true;
  if (url.startsWith("mailto:")) return true;
  if (title === "email us") return true;
  if (url.includes("subject=error") || snippet.includes("error getting results")) return true;
  if (domain.includes("startpage.com")) return true;
  return false;
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const kept: WebSearchResult[] = [];

  for (const result of results) {
    const key = result.url.replace(/[#?].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(result);
  }

  return kept;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}


async function getPdfjsLib() {
  pdfjsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsModulePromise;
}

function isLikelyPdfUrl(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

async function extractPdfTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("pdf") && !isLikelyPdfUrl(url)) {
    return "";
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const pdfjsLib = await getPdfjsLib();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  const pageCount = Math.min(pdf.numPages, PDF_PAGE_LIMIT);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? String(item.str || "") : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) {
      parts.push(pageText);
    }
  }

  return parts.join("\n").slice(0, MAX_MARKDOWN_CHARS);
}

async function createContext(input: WebSearchInput, language: McpLanguage): Promise<BrowserContext> {
  const browser = await getBrowser();

  return await browser.newContext({
    locale: language === "fr" ? "fr-CH" : "de-CH",
    timezoneId: "Europe/Zurich",
    geolocation: input.location
      ? {
          latitude: input.location.latitude,
          longitude: input.location.longitude,
        }
      : undefined,
    permissions: input.location ? ["geolocation"] : [],
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 SeniorNett/0.1 Chrome Safari",
    viewport: { width: 1280, height: 900 },
  });
}

async function searchStartpage(context: BrowserContext, query: string, language: McpLanguage, maxResults: number) {
  const page = await context.newPage();

  const params = new URLSearchParams({
    query,
    cat: "web",
    language: language === "fr" ? "francais" : "deutsch",
  });

  await page.goto(`https://www.startpage.com/sp/search?${params.toString()}`, {
    waitUntil: "domcontentloaded",
    timeout: SEARCH_TIMEOUT_MS,
  });

  await clickCookieButtons(page);

  const results = await page.$$eval("a[href]", (anchors) =>
    anchors
      .map((anchor) => {
        const visibleText = (anchor as HTMLElement).innerText || anchor.textContent || "";
        const title = visibleText.replace(/\s+/g, " ").trim();
        const url = anchor.getAttribute("href") || "";
        const container = anchor.closest("article, .w-gl__result, .result, .result-item, li, div");
        const snippetEl =
          container?.querySelector<HTMLElement>("p, .w-gl__description, .result-desc, .description, [data-testid='result-snippet']") ||
          anchor.parentElement?.querySelector<HTMLElement>("p");
        const snippet = snippetEl?.textContent?.replace(/\s+/g, " ").trim() || "";

        return { title, url, snippet };
      })
      .filter((entry) =>
        entry.title &&
        entry.url &&
        !entry.url.startsWith("/") &&
        !entry.url.startsWith("#") &&
        !/^(images|videos|news|maps|shopping|settings)$/i.test(entry.title)
      )
  );

  await page.close();

  return results
    .map((result) => {
      const url = unwrapSearchUrl(result.url);
      return {
        ...result,
        title: cleanSearchTitle(result.title, url),
        url,
        domain: domainFromUrl(url),
      };
    })
    .filter((result) => !isDiscardableSearchResult(result))
    .filter((result) => result.title !== result.domain || Boolean(result.snippet) || /\/[^/]+/.test(new URL(result.url).pathname))
    .filter((result, index, results) => results.findIndex((entry) => entry.url.replace(/[#?].*$/, "") === result.url.replace(/[#?].*$/, "")) === index)
    .slice(0, maxResults);
}

async function clickFirstVisibleControl(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const controls = [
      page.getByRole("button", { name: pattern }).first(),
      page.getByRole("link", { name: pattern }).first(),
    ];

    for (const control of controls) {
      try {
        if (await control.isVisible({ timeout: 500 })) {
          await control.click({ timeout: 1500 });
          return true;
        }
      } catch {
        // Ignore controls that disappear, are covered, or navigate unexpectedly.
      }
    }
  }

  return false;
}

async function clickFirstVisibleButton(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    try {
      if (await button.isVisible({ timeout: 500 })) {
        await button.click({ timeout: 1500 });
        return true;
      }
    } catch {
      // Ignore buttons that disappear or are covered by another element.
    }
  }

  return false;
}

async function clickCookieButtons(page: Page) {
  await clickFirstVisibleButton(page, [
    /ablehnen/i,
    /akzeptieren/i,
    /verstanden/i,
    /reject/i,
    /accept/i,
    /continuer/i,
    /refuser/i,
    /accepter/i,
  ]);
}

async function clickLoadMore(page: Page) {
  const patterns = [
    /^mehr$/i,
    /^more$/i,
    /mehr laden/i,
    /weitere anzeigen/i,
    /mehr anzeigen/i,
    /load more/i,
    /show more/i,
    /afficher plus/i,
    /voir plus/i,
    /plus de résultats/i,
    /mehr informationen/i,
    /details anzeigen/i,
    /alle anzeigen/i,
  ];

  for (let i = 0; i < 8; i += 1) {
    const before = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    const clicked = await clickFirstVisibleControl(page, patterns);
    if (!clicked) break;
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const after = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (after.length <= before.length + 80) break;
  }
}

async function extractPageMarkdown(page: Page): Promise<string> {
  const markdown = await page.evaluate(() => {
    const blockedSelectors = [
      "script",
      "style",
      "noscript",
      "svg",
      "nav",
      "footer",
      "header",
      "aside",
      "iframe",
      "[aria-hidden='true']",
    ];

    for (const selector of blockedSelectors) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }

    const root = document.querySelector("main") || document.querySelector("article") || document.body;
    if (!root) return "";

    const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const lines: string[] = [];
    const seen = new Set<string>();

    const push = (value: string) => {
      const cleaned = clean(value);
      if (!cleaned || cleaned.length < 2) return;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(cleaned);
    };

    const rowSelectors = [
      "tr",
      "[role='row']",
      "[class*='calendar-item']",
      "[class*='event']",
      "[class*='agenda']",
      "[class*='program']",
      "[class*='programme']",
      "[class*='schedule']",
      "[class*='calendar']",
    ];

    const firstText = (container: Element, selectors: string[]) => {
      for (const selector of selectors) {
        const text = clean(container.querySelector(selector)?.textContent);
        if (text) return text;
      }

      return "";
    };

    for (const row of Array.from(root.querySelectorAll("[class*='calendar-item'],[class*='event-item'],[class*='program-item'],[class*='programme-item']")).slice(0, 240)) {
      const weekday = firstText(row, [".weekday", "[class~='weekday']"]);
      const date = firstText(row, [".date", "[class~='date']"]);
      const time = firstText(row, ["time", "[class*='time']"]);
      const venue = firstText(row, [".location", "[class~='location']", "[class*='venue']", "[class*='place']"]);
      const category = firstText(row, [".division", "[class~='division']", "[class*='category']", "[class*='genre']", "[class*='type']"]);
      const title = firstText(row, [".play-name", "[class~='play-name']", "[class*='event-title']", "[class*='title']", "h2", "h3", "a"]);

      if (date && time && title) {
        push(`${[weekday, date].filter(Boolean).join(" ")}, ${time} | ${category} | ${title.replace(/\bInfo$/i, "").trim()} | ${venue}`);
      }
    }

    for (const row of Array.from(root.querySelectorAll(rowSelectors.join(","))).slice(0, 260)) {
      const cells = Array.from(row.querySelectorAll("th,td,[role='cell'],time,a,h2,h3,p,span"))
        .map((cell) => clean(cell.textContent))
        .filter(Boolean);
      const rowText = cells.length >= 2 ? cells.join(" | ") : clean(row.textContent);
      if (/(\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\b(?:mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun|lun|mar|mer|jeu|ven|sam|dim)\.?\b).{0,80}\d{1,2}[:.]\d{2}/i.test(rowText)) {
        push(rowText);
      }
    }

    const elements = Array.from(root.querySelectorAll("h1,h2,h3,p,li,address,dt,dd,td,th,time,[itemprop],.opening-hours,.openinghours,.hours,.address,.phone"));
    for (const element of elements.slice(0, 260)) {
      const tag = element.tagName.toLowerCase();
      const text = clean(element.textContent);
      if (!text) continue;
      if (/^(menu|navigation|teilen|share|cookie|copyright)$/i.test(text)) continue;

      if (tag === "h1") push(`# ${text}`);
      else if (tag === "h2") push(`## ${text}`);
      else if (tag === "h3") push(`### ${text}`);
      else if (tag === "li") push(`- ${text}`);
      else push(text);
    }

    const jsonLd = Array.from(document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']"))
      .map((script) => script.textContent || "")
      .join("\n");
    if (jsonLd) {
      const useful = jsonLd.match(/"(?:name|address|telephone|openingHours|streetAddress|addressLocality)"\s*:\s*"[^"]+"/g);
      useful?.slice(0, 20).forEach((entry) => push(entry.replace(/["{}]/g, "").replace(/\s*:\s*/, ": ")));
      const eventFields = jsonLd.match(/"(?:name|startDate|endDate|location|eventAttendanceMode)"\s*:\s*(?:"[^"]+"|\{[^}]+\})/g);
      eventFields?.slice(0, 80).forEach((entry) => push(entry.replace(/["{}]/g, "").replace(/\s*:\s*/, ": ")));
    }

    return lines.join("\n");
  });

  return normalizeContentText(markdown).slice(0, MAX_MARKDOWN_CHARS);
}

async function crawlResult(context: BrowserContext, result: WebSearchResult, input: WebSearchInput, searchedAt: Date): Promise<WebSearchResult> {
  if (!isSafeHttpUrl(result.url)) {
    return result;
  }

  if (isLikelyPdfUrl(result.url)) {
    try {
      const text = await extractPdfTextFromUrl(result.url);
      if (text) {
        const extracted = extractUsefulInfo(text, result.title, { query: input.query, searchedAt });
        return {
          ...result,
          text,
          markdown: text,
          extracted,
        };
      }
    } catch {
      // Ignore PDF parsing errors and fall through to normal crawl.
    }
  }

  const page = await context.newPage();

  try {
    await page.goto(result.url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    await clickCookieButtons(page);
    await clickLoadMore(page);

    const markdown = await extractPageMarkdown(page);
    const text = markdown.replace(/^#{1,3}\s+/gm, "").replace(/^- /gm, "");
    const extracted = extractUsefulInfo(markdown, result.title, { query: input.query, searchedAt });

    return {
      ...result,
      text: text.slice(0, MAX_TEXT_CHARS),
      markdown,
      extracted,
    };
  } catch {
    return result;
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function performWebSearch(input: WebSearchInput, language: McpLanguage): Promise<WebSearchRaw> {
  const query = buildSearchQuery(input, language);
  const searchedAt = new Date();
  const maxResults = Math.max(1, Math.min(MAX_RESULTS, input.maxResults ?? MAX_RESULTS));
  let context: BrowserContext;

  try {
    context = await createContext(input, language);
  } catch {
    return {
      query,
      intent: input.intent,
      resolvedPlace: input.resolvedPlace || input.location?.label || null,
      results: [],
      searchedAt: new Date().toISOString(),
      warning: "browser_context_failed",
    };
  }

  try {
    const searchResults = dedupeResults(await searchStartpage(context, query, language, maxResults).catch(() => []));
    const warning = searchResults.length ? undefined : "startpage_empty";
    const crawled = await Promise.all(searchResults.slice(0, MAX_CRAWL_RESULTS).map((result) => crawlResult(context, result, input, searchedAt)));

    const merged = rankResults(input, searchResults.map((result) => crawled.find((entry) => entry.url === result.url) || result));

    return {
      query,
      intent: input.intent,
      resolvedPlace: input.resolvedPlace || input.location?.label || null,
      results: merged,
      searchedAt: searchedAt.toISOString(),
      warning: merged.length ? undefined : warning || "no_results",
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

function compactResult(result: WebSearchResult, language: McpLanguage): string {
  const hasSchedule = Boolean(result.extracted?.scheduleRows.length);
  const hasDocumentFacts = Boolean(result.extracted?.documentFacts.length);
  const documentFacts = result.extracted?.documentFacts.length
    ? result.extracted.documentFacts.slice(0, 12).map((fact) => `- ${fact.label}: ${fact.value}`).join("\n")
    : "";
  const extracted = result.extracted && !hasSchedule && !hasDocumentFacts ? formatExtractedInfo(result.extracted, language) : "";
  const schedule = result.extracted ? formatScheduleRows(result.extracted.scheduleRows, language) : "";
  const title = cleanSearchTitle(result.extracted?.likelyNames[0] || result.title, result.url);
  const parts = [
    `**${title}**`,
    result.domain ? `Quelle: ${result.domain}` : "",
    result.snippet,
    schedule,
    documentFacts,
    extracted,
    !hasSchedule && !hasDocumentFacts && result.markdown ? result.markdown.slice(0, 1200) : !hasSchedule && !hasDocumentFacts && result.text ? result.text.slice(0, 900) : "",
  ].filter(Boolean);

  return parts.join("\n");
}

export function buildWebSearchAnswer(raw: WebSearchRaw, language: McpLanguage): string {
  if (!raw.results.length) {
    const issueHint = raw.warning
      ? language === "fr"
        ? ` (détail technique: ${raw.warning})`
        : ` (technischer Hinweis: ${raw.warning})`
      : "";
    return language === "fr"
      ? `Je n'ai pas trouvé de résultats suffisamment fiables${issueHint}. Essaie avec un nom précis (p. ex. magasin/lieu) ou un autre mot-clé.`
      : `Ich habe keine ausreichend verlässlichen Treffer gefunden${issueHint}. Versuch es mit einem konkreten Namen (z.B. Geschäft/Ort) oder einem anderen Stichwort.`;
  }

  const heading = language === "fr" ? "# Résultats trouvés" : "# Gefundene Informationen";
  const sourceLine = language === "fr" ? `Recherche: ${raw.query}` : `Suche: ${raw.query}`;
  const placeLine = raw.resolvedPlace
    ? language === "fr"
      ? `Lieu utilisé: ${raw.resolvedPlace}`
      : `Verwendeter Ort: ${raw.resolvedPlace}`
    : null;

  const scheduleResults = raw.results.filter((result) => result.extracted?.scheduleRows.length);
  const documentResults = raw.results.filter((result) => result.extracted?.documentFacts.length);
  const displayResults = (scheduleResults.length ? scheduleResults : documentResults.length ? documentResults : raw.results).slice(0, 4);
  const lines = displayResults.map((result, index) => `## ${index + 1}. ${compactResult(result, language)}`);

  return [heading, sourceLine, placeLine, ...lines].filter(Boolean).join("\n\n");
}

export function buildWebSearchObservation(raw: WebSearchRaw, language: McpLanguage, requestSummary: string): McpToolObservation {
  return {
    toolName: webSearchPrompt.toolName,
    requestSummary,
    resultSummary: buildWebSearchAnswer(raw, language),
    status: raw.results.length ? "ok" : "needs_user_input",
    payload: JSON.stringify({
      query: raw.query,
      intent: raw.intent,
      resolvedPlace: raw.resolvedPlace,
      searchedAt: raw.searchedAt,
      warning: raw.warning ?? null,
      results: raw.results.map((result) => ({
        hasScheduleRows: Boolean(result.extracted?.scheduleRows.length),
        title: result.title,
        domain: result.domain,
        url: result.url,
        snippet: result.snippet,
        extracted: result.extracted
          ? {
              ...result.extracted,
              openingHours: result.extracted.scheduleRows.length ? [] : result.extracted.openingHours,
              scheduleRows: result.extracted.scheduleRows.slice(0, 60),
              documentFacts: result.extracted.documentFacts.slice(0, 60),
            }
          : null,
        scheduleRows: result.extracted?.scheduleRows.slice(0, 60) ?? [],
        markdown: result.extracted?.scheduleRows.length || result.extracted?.documentFacts.length ? null : result.markdown ? result.markdown.slice(0, 1800) : null,
        text: result.extracted?.scheduleRows.length || result.extracted?.documentFacts.length ? null : result.text ? result.text.slice(0, 1200) : null,
      })),
    }),
  };
}

export const _webSearchTestInternals = {
  buildSearchQuery,
  extractUsefulInfo,
  normalizeContentText,
  rankResults,
  scoreResult,
  ..._extractTestInternals,
  ..._documentLookupTestInternals,
};
