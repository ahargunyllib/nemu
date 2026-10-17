/**
 * Loads the Nemu Extension into Playwright's Chromium and drives it on the Demo App, to check
 * what the unit tests can't: the allowlist, the shadow-root overlay, background ↔ content
 * messaging, and the Demo App session cookie reaching the Nemu Service.
 *
 * It opens the Composer by sending the background's open message from the service worker,
 * because automation can't press the toolbar icon or the browser-level shortcut. Check the
 * shortcut itself by hand.
 *
 * Needs the dev stack in fixture mode (`NEMU_RESPONDER=fixture pnpm dev`), which also keeps
 * .output/chrome-mv3-dev built. Run `pnpm --filter extension verify`; add `-- --headed` to watch.
 */
import {
  momentOneRequest,
  momentOneResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { type BrowserContext, chromium, type Locator, type Page } from "playwright-core";
import type { browser } from "wxt/browser";

import { OPEN_COMPOSER_MESSAGE } from "../features/composer/lib/open-composer-message.ts";
import { RING_PADDING } from "../features/highlight/lib/highlight-targets.ts";
import { ALLOWED_ORIGINS, DEFAULT_SERVER_URL } from "../shared/lib/config.ts";

const EXTENSION_DIR = path.resolve(import.meta.dirname, "../.output/chrome-mv3-dev");
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, "../.output/verify");
const [DEMO_APP_URL = ""] = ALLOWED_ORIGINS;
// The Nemu Service's own origin is not on the allowlist, so it must get no overlay.
const OUTSIDE_URL = DEFAULT_SERVER_URL;
const TIMEOUT_MS = 15_000;
// Issue #8: Momen 1 must succeed five times out of five.
const MOMEN_1_RUNS = 5;

// The service worker's own extension API, which `worker.evaluate` callbacks run against.
declare const chrome: typeof browser;

async function assertReachable(url: string) {
  const response = await fetch(url).catch(() => null);
  if (!response) {
    throw new Error(
      `${url} is not reachable. Start the dev stack: NEMU_RESPONDER=fixture pnpm dev`,
    );
  }
}

/** Does what the background does when the toolbar icon or Ctrl+Shift+Space fires the action. */
async function openComposer(context: BrowserContext, page: Page) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await page.locator("nemu-overlay").waitFor({ state: "attached" });
  await worker.evaluate(
    async ({ url, message }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url === url);
      if (tab?.id === undefined) throw new Error(`no tab at ${url}`);
      await chrome.tabs.sendMessage(tab.id, message);
    },
    { url: page.url(), message: OPEN_COMPOSER_MESSAGE },
  );
}

async function ask(context: BrowserContext, page: Page, prompt: string) {
  await openComposer(context, page);
  const composer = page.getByRole("textbox", { name: "Pertanyaan untuk Nemu" });
  await composer.fill(prompt);
  await composer.press("Enter");
}

async function closeAnswerCard(page: Page) {
  await page.getByRole("button", { name: "Tutup" }).click();
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${String(locator)} is not rendered`);
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The target's box grown by the ring's padding, which is where the ring must sit. */
function ringAround(target: Box): Box {
  return {
    x: target.x - RING_PADDING,
    y: target.y - RING_PADDING,
    width: target.width + 2 * RING_PADDING,
    height: target.height + 2 * RING_PADDING,
  };
}

function sameBox(a: Box, b: Box): boolean {
  return [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every(
    (difference) => Math.abs(difference) <= 1,
  );
}

/** Waits out the smooth scroll that brings the first highlight target into view. */
async function waitForScrollToSettle(page: Page) {
  let last: number | undefined;
  for (;;) {
    const scrollY = await page.evaluate(() => window.scrollY);
    if (scrollY === last) return;
    last = scrollY;
    await page.waitForTimeout(300);
  }
}

/** Retries `assertion` until it passes, for overlay layout that follows the page a frame late. */
async function eventually(assertion: () => Promise<void>) {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function main() {
  if (!existsSync(path.join(EXTENSION_DIR, "manifest.json"))) {
    throw new Error(`No dev build at ${EXTENSION_DIR}. Start the dev stack: pnpm dev`);
  }
  await assertReachable(DEMO_APP_URL);
  await assertReachable(OUTSIDE_URL);
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext("", {
    // The full Chromium build, not the headless shell, because the shell can't load extensions.
    channel: "chromium",
    headless: !process.argv.includes("--headed"),
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  context.setDefaultTimeout(TIMEOUT_MS);
  const page = await context.newPage();
  let failed = false;

  async function check(name: string, run: () => Promise<void>) {
    try {
      await run();
      console.log(`✔ ${name}`);
    } catch (error) {
      failed = true;
      const screenshot = path.join(SCREENSHOT_DIR, `failed-${name.replaceAll(/\W+/g, "-")}.png`);
      await page.screenshot({ path: screenshot }).catch(() => undefined);
      console.error(`✘ ${name}\n  ${String(error).split("\n")[0]}\n  screenshot: ${screenshot}`);
    }
  }

  try {
    await check("pages outside the allowlist get no overlay", async () => {
      await page.goto(OUTSIDE_URL);
      await page.waitForTimeout(1_000);
      const overlays = await page.locator("nemu-overlay").count();
      if (overlays > 0) throw new Error(`found ${overlays} nemu-overlay on ${OUTSIDE_URL}`);
    });

    await check("signed out, the card asks Rina to log in", async () => {
      await page.goto(`${DEMO_APP_URL}/login`);
      await ask(context, page, momentOneRequest.prompt);
      await page.getByRole("alert").getByText("Kamu belum masuk ke Demo App").waitFor();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "signed-out.png") });
      await closeAnswerCard(page);
    });

    await check("signed in, the Answer Card shows the answer and its citation", async () => {
      await page.getByRole("button", { name: /Masuk sebagai Rina/ }).click();
      await page.getByRole("heading", { name: "Beranda" }).waitFor();
      await ask(context, page, momentOneRequest.prompt);
      await page.getByText(momentOneResponse.answer.ringkas).waitFor();
      const [citation] = momentOneResponse.citations;
      if (citation) {
        await page
          .getByRole("region", { name: "Sumber" })
          .getByRole("button", { name: citation.judul })
          .waitFor();
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "answer-card.png") });
    });

    await check(
      `Momen 1 clicks the menu and opens the form, ${MOMEN_1_RUNS} out of ${MOMEN_1_RUNS}`,
      async () => {
        for (let run = 1; run <= MOMEN_1_RUNS; run++) {
          await page.goto(DEMO_APP_URL);
          await page.getByRole("heading", { name: "Beranda" }).waitFor();
          await ask(context, page, momentOneRequest.prompt);
          await page.getByText(momentOneResponse.answer.ringkas).waitFor();
          // Morph (200 ms) and part of the move: the cursor is on its way to the menu.
          await page.waitForTimeout(400);
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-1-clicking.png") });
          }
          await page.waitForURL(`${DEMO_APP_URL}/perdin/baru`);
          await page.getByRole("button", { name: "Lihat detail" }).click();
          await page.getByText("Rincian perkiraan biaya", { exact: false }).waitFor();
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-1-form.png") });
          }
          await closeAnswerCard(page);
        }
      },
    );

    await check(
      "on the form, Momen 2 rings its targets and the Answer Card avoids them",
      async () => {
        await page.goto(`${DEMO_APP_URL}/perdin/baru`);
        await page.getByRole("heading", { name: "Ajukan Perjalanan Dinas" }).waitFor();
        await ask(context, page, momentTwoRequest.prompt);

        const overlay = page.locator("nemu-overlay");
        const card = overlay
          .locator('[data-slot="card"]')
          .filter({ hasText: momentTwoResponse.answer.ringkas });
        await card.waitFor();
        for (const warning of momentTwoResponse.warnings) {
          await card.getByRole("list", { name: "Peringatan" }).getByText(warning).waitFor();
        }

        const highlights = momentTwoResponse.actions.filter(({ type }) => type === "highlight");
        if (highlights.length === 0) throw new Error("momentTwoResponse has no highlight actions");
        await waitForScrollToSettle(page);
        await eventually(async () => {
          const cardBox = await boxOf(card);
          for (const { target, label } of highlights) {
            const targetBox = await boxOf(page.locator(`[data-nemu-id="${target}"]`).first());
            const badge = overlay.getByText(label, { exact: true });
            if (!(await badge.isVisible())) throw new Error(`no "${label}" label on ${target}`);
            const ringBox = await boxOf(badge.locator(".."));
            if (!sameBox(ringBox, ringAround(targetBox))) {
              throw new Error(`the "${label}" ring isn't around ${target}`);
            }
            if (overlaps(cardBox, targetBox)) throw new Error(`the Answer Card covers ${target}`);
          }
        });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-2-highlight.png") });
      },
    );
  } finally {
    await context.close();
  }

  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  if (failed) process.exitCode = 1;
}

await main();
