import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditViewports, seniorFacingRoutes } from "./routes";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const outputRoot = path.join(process.cwd(), "visual-audit");
const screenshotRoot = path.join(outputRoot, "screenshots");
const axeRoot = path.join(outputRoot, "axe");
const reportPath = path.join(outputRoot, "report.md");
const captureDelayMs = Number(process.env.VISUAL_CAPTURE_DELAY_MS || 5_000);

type AuditEntry = {
  route: string;
  routeName: string;
  viewport: string;
  screenshot: string;
  axeJson: string;
  issues: number;
  suspiciousText: string[];
  settled: boolean;
};

const entries: AuditEntry[] = [];

function safeName(value: string) {
  return value.replace(/^\//, "home").replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").toLowerCase();
}

function findSuspiciousText(text: string) {
  const candidates = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set(candidates.filter((part) =>
    /^[a-z][a-z0-9]+(?:\.[a-z0-9]+){1,}$/i.test(part) ||
    /^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(part) ||
    /^[a-z]+:[a-z0-9_-]+$/i.test(part)
  ))].slice(0, 20);
}

async function waitForSeniorNettToSettle(page: Page) {
  await page.waitForTimeout(captureDelayMs);
  await page.waitForLoadState("networkidle", { timeout: 1_000 }).catch(() => undefined);

  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      return Boolean(htmlElement.offsetParent || htmlElement.getClientRects().length);
    };

    const blockingSelectors = [
      ".media-empty .spin",
      ".messaging-placeholder .spin",
      ".video-loading",
      ".weather-loading",
      ".map-loading-panel",
    ];

    return blockingSelectors.every((selector) =>
      Array.from(document.querySelectorAll(selector)).every((element) => !isVisible(element))
    );
  });
}

test.describe("SeniorNett visual and accessibility audit", () => {
  test.beforeAll(() => {
    mkdirSync(screenshotRoot, { recursive: true });
    mkdirSync(axeRoot, { recursive: true });
  });

  for (const route of seniorFacingRoutes) {
    for (const viewport of auditViewports) {
      test(`${route.name} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
        const settled = await waitForSeniorNettToSettle(page);

        await page.addScriptTag({ content: axeSource });
        const axeResult = await page.evaluate(async () => {
          return await window.axe.run(document, {
            resultTypes: ["violations"],
          });
        });

        const bodyText = await page.locator("body").innerText();
        const suspiciousText = findSuspiciousText(bodyText);
        const fileBase = `${safeName(route.path)}-${viewport.name}`;
        const screenshotPath = path.join(screenshotRoot, `${fileBase}.png`);
        const axePath = path.join(axeRoot, `${fileBase}.json`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        writeFileSync(axePath, JSON.stringify(axeResult, null, 2));

        entries.push({
          route: route.path,
          routeName: route.name,
          viewport: viewport.name,
          screenshot: path.relative(process.cwd(), screenshotPath),
          axeJson: path.relative(process.cwd(), axePath),
          issues: axeResult.violations.length,
          suspiciousText,
          settled,
        });

        expect(suspiciousText, `Suspicious rendered text on ${route.path}`).toEqual([]);
      });
    }
  }

  test.afterAll(() => {
    const rows = entries
      .sort((a, b) => `${a.route}-${a.viewport}`.localeCompare(`${b.route}-${b.viewport}`))
      .map((entry) => (
        `| ${entry.routeName} | ${entry.route} | ${entry.viewport} | ${entry.screenshot} | ${entry.issues} | ${entry.settled ? "ja" : "nein"} | ${entry.suspiciousText.join(", ") || "-"} |`
      ));

    writeFileSync(
      reportPath,
      [
        "# SeniorNett Visual Audit",
        "",
        "| Route | Path | Viewport | Screenshot | Axe issues | Settled | Suspicious text |",
        "|---|---|---|---|---:|---|---|",
        ...rows,
        "",
        "Axe JSON files are saved in `visual-audit/axe`.",
      ].join("\n")
    );
  });
});

declare global {
  interface Window {
    axe: {
      run: (document: Document, options?: unknown) => Promise<{ violations: unknown[] }>;
    };
  }
}
