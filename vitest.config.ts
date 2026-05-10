import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/chat/**/*.test.ts", "tests/quality/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: "forks",
  },
});
