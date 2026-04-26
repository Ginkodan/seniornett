import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "visual-audit", "report.md");

if (!existsSync(reportPath)) {
  console.error(`No visual audit report found at ${reportPath}.`);
  console.error("Run `npm run visual:audit` first, then run `npm run visual:report`.");
  console.error("If Playwright says the browser is missing, run `npm run visual:install` once.");
  process.exit(1);
}

console.log(readFileSync(reportPath, "utf8"));
