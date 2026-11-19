// Smoke test of the built app in headless Chromium.
// Fails on page errors or console errors, and saves screenshots to screenshots/.
// Run with: npm run check:screenshot

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: "warn" });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const problems = [];

async function open(url, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`[${name}] console error: ${m.text()}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.screenshot({ path: `screenshots/${name}.png` });
  return page;
}

try {
  mkdirSync("screenshots", { recursive: true });

  const desktop = await open(base, "desktop", { width: 1280, height: 800 });
  const name = await desktop.textContent("#hole-name");
  if (name !== "The Elbow") problems.push(`expected example hole, got "${name}"`);
  const code = await desktop.inputValue("#code");
  if (!code.startsWith("GH1.")) problems.push("no share code shown");

  // Open the hole from its own share link in a fresh page.
  const shared = await open(`${base}#hole=${code}`, "from-link", { width: 1280, height: 800 });
  if ((await shared.inputValue("#code")) !== code) problems.push("share link did not round-trip to the same code");
  if (!(await shared.textContent("#status")).includes("share code")) problems.push("hole was not loaded from the link");

  await open(base, "phone", { width: 390, height: 844 });
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Screenshot check passed. Images are in screenshots/.");
