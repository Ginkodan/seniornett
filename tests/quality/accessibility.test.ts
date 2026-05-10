import { chromium, type Browser, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, test } from "vitest";

import {
  REVIEW_ROUTES,
  TABLET_LANDSCAPE_VIEWPORT,
  getQualityBaseUrl,
  shouldRunQualityTests,
  type ReviewRoute,
} from "./routes";

type AxeViolationRow = {
  route: string;
  name: string;
  viewport: typeof TABLET_LANDSCAPE_VIEWPORT;
  violationId: string;
  impact: string;
  help: string;
  helpUrl: string;
  selector: string;
  html: string;
  description: string;
  tags: string[];
};

type AxeResults = {
  violations: Array<{
    id: string;
    impact?: string | null;
    help: string;
    helpUrl: string;
    description: string;
    tags: string[];
    nodes: Array<{
      target: string[];
      html: string;
    }>;
  }>;
};

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const baseUrl = getQualityBaseUrl();
const reportDir = path.join(process.cwd(), "reports/accessibility");
const screenshotDir = path.join(reportDir, "screenshots/tablet-landscape");
const jsonPath = path.join(reportDir, "a11y-results.json");
const markdownPath = path.join(reportDir, "a11y-report.md");
const auditTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function loadRoute(page: Page, route: ReviewRoute): Promise<void> {
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForTimeout(600);
}

async function runAxe(page: Page, route: ReviewRoute): Promise<{ route: string; name: string; violations: AxeViolationRow[] }> {
  await page.addScriptTag({ path: axePath });

  const results = await page.evaluate(async (tags) => {
    const axe = (window as unknown as { axe: { run: (node: Document, options: unknown) => Promise<AxeResults> } }).axe;
    return await axe.run(document, {
      runOnly: {
        type: "tag",
        values: tags,
      },
      resultTypes: ["violations"],
    });
  }, auditTags);

  return {
    route: route.path,
    name: route.name,
    violations: results.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        route: route.path,
        name: route.name,
        viewport: TABLET_LANDSCAPE_VIEWPORT,
        violationId: violation.id,
        impact: violation.impact || "unknown",
        help: violation.help,
        helpUrl: violation.helpUrl,
        selector: node.target.join(" "),
        html: node.html,
        description: violation.description,
        tags: violation.tags,
      }))
    ),
  };
}

function groupByRoute(rows: AxeViolationRow[]): Record<string, AxeViolationRow[]> {
  return rows.reduce<Record<string, AxeViolationRow[]>>((acc, row) => {
    acc[row.route] ||= [];
    acc[row.route].push(row);
    return acc;
  }, {});
}

function renderMarkdown(rows: AxeViolationRow[]): string {
  const byRoute = groupByRoute(rows);
  const lines = [
    "# SeniorNett accessibility audit",
    "",
    `Base URL: \`${baseUrl}\``,
    `Viewport: \`${TABLET_LANDSCAPE_VIEWPORT.width}x${TABLET_LANDSCAPE_VIEWPORT.height}\``,
    "",
  ];

  if (!rows.length) {
    lines.push("No accessibility violations were found.");
    return lines.join("\n");
  }

  for (const route of REVIEW_ROUTES) {
    const routeRows = byRoute[route.path] || [];
    lines.push(`## ${route.name}`);
    lines.push("");

    if (!routeRows.length) {
      lines.push("No violations.");
      lines.push("");
      continue;
    }

    for (const row of routeRows) {
      lines.push(`- **${row.violationId}**`);
      lines.push(`  - Impact: ${row.impact}`);
      lines.push(`  - Help: ${row.help}`);
      lines.push(`  - Selector: \`${row.selector}\``);
      lines.push(`  - HTML: \`${row.html.replace(/\s+/g, " ").slice(0, 160)}\``);
      lines.push(`  - Help URL: ${row.helpUrl}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

describe.skipIf(!shouldRunQualityTests())("quality: accessibility audit", () => {
  let browser: Browser;

  beforeAll(async () => {
    await mkdir(reportDir, { recursive: true });
    await mkdir(screenshotDir, { recursive: true });
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  test("runs axe over tablet routes and writes reports", async () => {
    const page = await browser.newPage({ viewport: TABLET_LANDSCAPE_VIEWPORT });
    const rows: AxeViolationRow[] = [];
    const routeSummaries = [];

    for (const route of REVIEW_ROUTES) {
      await loadRoute(page, route);
      const audit = await runAxe(page, route);
      routeSummaries.push({ route: route.path, name: route.name, count: audit.violations.length });
      rows.push(...audit.violations);
    }

    if (REVIEW_ROUTES.length > 0) {
      const home = REVIEW_ROUTES[0];
      await loadRoute(page, home);
      await page.screenshot({
        path: path.join(screenshotDir, "home--tablet-landscape--normal.png"),
        fullPage: true,
      });
    }

    await page.close();

    const severe = rows.filter((row) => row.impact === "serious" || row.impact === "critical");
    const payload = {
      baseUrl,
      viewport: TABLET_LANDSCAPE_VIEWPORT,
      tags: auditTags,
      routeSummaries,
      violations: rows,
      severeCount: severe.length,
    };

    await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
    await writeFile(markdownPath, renderMarkdown(rows), "utf8");

    if (severe.length > 0) {
      throw new Error(`Accessibility audit found ${severe.length} serious or critical violations.`);
    }
  });
});
