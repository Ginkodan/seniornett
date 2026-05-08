import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  HOME_ROUTE,
  REVIEW_ROUTES,
  SECONDARY_TABLET_VIEWPORT,
  TABLET_LANDSCAPE_VIEWPORT,
  VISION_DEFICIENCIES,
} from "./routes.mjs";

const baseUrl =
  process.env.UI_REVIEW_BASE_URL ||
  process.env.A11Y_BASE_URL ||
  process.env.VISUAL_BASE_URL ||
  "http://127.0.0.1:5176";

const outputDir = path.join(process.cwd(), "reports/ui-review/after/tablet-landscape");
const visionDir = path.join(process.cwd(), "reports/accessibility/screenshots/tablet-landscape");

function isBenignConsoleError(text) {
  return (
    text.includes("webpack-hmr") ||
    text.includes("WebSocket connection") ||
    text.includes("Download the React DevTools")
  );
}

function isBenignPageError(text) {
  return text.includes("Invalid or unexpected token");
}

async function loadRoute(page, route) {
  const errors = [];
  const pageErrors = [];

  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!isBenignConsoleError(text)) {
        errors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => {
    if (!isBenignPageError(error.message)) {
      pageErrors.push(error.message);
    }
  });

  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForTimeout(1_000);

  return { errors, pageErrors };
}

async function runKeyboardProbe(page) {
  const sequence = [];

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) {
        return { tag: "", label: "", outline: "", boxShadow: "", text: "" };
      }

      const style = window.getComputedStyle(element);
      const label = element.getAttribute("aria-label") || element.getAttribute("title") || "";

      return {
        tag: element.tagName,
        label,
        outline: style.outlineStyle,
        boxShadow: style.boxShadow,
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      };
    });

    sequence.push(focusState);
  }

  const uniqueTargets = new Set(sequence.map((item) => `${item.tag}|${item.label}|${item.text}`));
  const visibleFocus = sequence.some((item) => item.outline !== "none" || item.boxShadow !== "none");

  if (uniqueTargets.size < 2) {
    throw new Error("Keyboard probe did not move focus to more than one target.");
  }

  if (!visibleFocus) {
    throw new Error("Keyboard probe did not find a visible focus state.");
  }
}

async function captureVisionVariants(page) {
  const cdp = await page.context().newCDPSession(page);
  const routePrefix = "home--tablet-landscape";

  for (const deficiency of VISION_DEFICIENCIES) {
    await cdp.send("Emulation.setEmulatedVisionDeficiency", {
      type: deficiency,
    });

    await page.waitForTimeout(300);
    const label = deficiency === "none" ? "normal" : deficiency;
    await page.screenshot({
      path: path.join(visionDir, `${routePrefix}--${label}.png`),
      fullPage: true,
    });
  }

  await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: "none" });
}

async function runSecondaryViewportCheck(browser) {
  const page = await browser.newPage({ viewport: SECONDARY_TABLET_VIEWPORT });
  const issues = [];

  for (const route of REVIEW_ROUTES) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "attached", timeout: 15_000 });
    await page.waitForTimeout(400);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 8) {
      issues.push({ route: route.name, overflow });
    }
  }

  await page.close();
  return issues;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(visionDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: TABLET_LANDSCAPE_VIEWPORT });
  const results = [];

  for (const route of REVIEW_ROUTES) {
    const loadResult = await loadRoute(page, route);
    await page.screenshot({
      path: path.join(outputDir, `${route.name}.png`),
      fullPage: true,
    });

    await runKeyboardProbe(page);

    if (route.name === HOME_ROUTE.name) {
      await captureVisionVariants(page);
    }

    results.push({
      route: route.path,
      name: route.name,
      viewport: TABLET_LANDSCAPE_VIEWPORT,
      consoleErrors: loadResult.errors,
      pageErrors: loadResult.pageErrors,
      focusProbe: "passed",
    });
  }

  const overflowIssues = await runSecondaryViewportCheck(browser);
  await browser.close();

  const summary = {
    baseUrl,
    viewport: TABLET_LANDSCAPE_VIEWPORT,
    secondaryViewport: SECONDARY_TABLET_VIEWPORT,
    routes: results,
    overflowIssues,
  };

  await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  const hasConsoleErrors = results.some((entry) => entry.consoleErrors.length || entry.pageErrors.length);
  const hasOverflowIssues = overflowIssues.length > 0;

  if (hasConsoleErrors || hasOverflowIssues) {
    const messages = [];

    if (hasConsoleErrors) {
      messages.push("Console or page errors were found during UI review.");
    }

    if (hasOverflowIssues) {
      messages.push("Horizontal overflow was detected in the 1024x768 tablet check.");
    }

    throw new Error(messages.join(" "));
  }

  console.log(`UI review complete for ${REVIEW_ROUTES.length} routes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
