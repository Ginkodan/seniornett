"use server";

export type WikiResult = {
  title: string;
  extract: string; // sanitized HTML
};

/**
 * Sanitize Wikipedia HTML extract for safe, senior-friendly display.
 * Strips math, images, footnotes, links, tables, all attributes.
 */
function sanitizeWikiHtml(raw: string): string {
  let html = raw;

  // 1. Remove <math>...</math> blocks (MathML)
  html = html.replace(/<math\b[\s\S]*?<\/math>/gi, '');

  // 2. Remove <img> tags (mostly math fallback images + thumbnails)
  html = html.replace(/<img\b[^>]*\/?>/gi, '');

  // 3. Remove <figure> / <figcaption> blocks (article images)
  html = html.replace(/<figure\b[\s\S]*?<\/figure>/gi, '');

  // 4. Remove <table> blocks (taxonomy boxes, infoboxes)
  html = html.replace(/<table\b[\s\S]*?<\/table>/gi, '');

  // 5. Remove footnote superscripts
  html = html.replace(/<sup\b[\s\S]*?<\/sup>/gi, '');

  // 6. Remove edit-section UI spans
  html = html.replace(/<span\b[^>]*mw-editsection[^>]*>[\s\S]*?<\/span>/g, '');

  // 7. Iteratively remove empty spans (handles nesting from math removal)
  let prev = '';
  while (prev !== html) {
    prev = html;
    html = html.replace(/<span[^>]*>\s*<\/span>/g, '');
  }

  // 8. Unwrap links → keep visible text, remove <a> wrapper
  html = html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 9. Strip all HTML attributes (class, id, style, href, data-*, etc.)
  html = html.replace(
    /\s(?:class|id|style|href|src|srcset|alt|title|rel|target|lang|dir|about|typeof|role|aria-[\w-]+|data-[\w-]+)(?:="[^"]*"|='[^']*')?/g,
    ''
  );

  // 10. Unwrap remaining bare <span> tags
  prev = '';
  while (prev !== html) {
    prev = html;
    html = html.replace(/<span>([\s\S]*?)<\/span>/g, '$1');
  }

  // 11. Remove empty block elements
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<div[^>]*>\s*<\/div>/g, '');

  // 12. Unwrap <div> wrappers (keep content)
  html = html.replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1');

  return html.trim();
}

export async function searchWikipediaAction(query: string): Promise<WikiResult[]> {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  try {
    const searchUrl = `https://de.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(trimmed)}&limit=5&format=json`;
    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    if (!searchRes.ok) return [];

    const [, titles] = (await searchRes.json()) as [string, string[]];
    if (!titles?.length) return [];

    const results = await Promise.all(
      titles.map(async (title) => {
        try {
          const extractUrl = `https://de.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageprops&redirects=1&format=json`;
          const res = await fetch(extractUrl, { cache: "no-store" });
          if (!res.ok) return null;
          const data = await res.json();
          const pages = Object.values(data?.query?.pages ?? {}) as Array<Record<string, unknown>>;
          const page = pages[0];
          // Skip disambiguation pages
          const pageProps = page?.pageprops as Record<string, unknown> | undefined;
          if (pageProps?.disambiguation !== undefined) return null;
          const rawExtract = typeof page?.extract === "string" ? page.extract.trim() : "";
          const pageTitle = typeof page?.title === "string" ? page.title : title;
          if (!rawExtract) return null;
          const extract = sanitizeWikiHtml(rawExtract);
          return extract ? { title: pageTitle, extract } : null;
        } catch {
          return null;
        }
      })
    );

    return results.filter((r): r is WikiResult => r !== null);
  } catch {
    return [];
  }
}
