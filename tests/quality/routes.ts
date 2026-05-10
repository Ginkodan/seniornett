import type { ViewportSize } from "@playwright/test";

export type ReviewRoute = {
  name: string;
  path: string;
};

export const REVIEW_ROUTES: ReviewRoute[] = [
  { name: "home", path: "/" },
  { name: "social-hub", path: "/social-hub" },
  { name: "news", path: "/news" },
  { name: "lotti-live", path: "/lotti-live" },
  { name: "audio", path: "/audio" },
  { name: "sbb", path: "/sbb" },
  { name: "lexikon", path: "/lexikon" },
  { name: "karte", path: "/karte" },
  { name: "video", path: "/video" },
  { name: "notfall", path: "/notfall" },
];

export const HOME_ROUTE = REVIEW_ROUTES[0];
export const TABLET_LANDSCAPE_VIEWPORT: ViewportSize = { width: 1180, height: 820 };
export const SECONDARY_TABLET_VIEWPORT: ViewportSize = { width: 1024, height: 768 };
export const VISION_DEFICIENCIES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
  "reducedContrast",
  "blurredVision",
] as const;

export function getQualityBaseUrl(): string {
  return (
    process.env.QUALITY_BASE_URL ||
    process.env.UI_REVIEW_BASE_URL ||
    process.env.A11Y_BASE_URL ||
    process.env.VISUAL_BASE_URL ||
    "http://127.0.0.1:3000"
  );
}

export function shouldRunQualityTests(): boolean {
  return process.env.RUN_QUALITY_TESTS === "true";
}
