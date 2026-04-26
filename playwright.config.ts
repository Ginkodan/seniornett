import { defineConfig } from "@playwright/test";

const visualBaseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5176";

export default defineConfig({
  testDir: "tests/visual",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: visualBaseUrl,
  },
  webServer: process.env.VISUAL_BASE_URL
    ? undefined
    : {
        command: "./node_modules/.bin/next dev --webpack --hostname 127.0.0.1 --port 5176",
        reuseExistingServer: true,
        timeout: 120_000,
        url: visualBaseUrl,
      },
});
