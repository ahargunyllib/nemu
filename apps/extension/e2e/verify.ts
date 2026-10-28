/**
 * Loads the Nemu Extension into Playwright's Chromium and drives it on the Demo App, to check
 * what the unit tests can't: the allowlist, the shadow-root overlay, background ↔ content
 * messaging, and the Demo App session cookie reaching the Nemu Service.
 *
 * It opens the Composer by sending the background's open message from the service worker,
 * because automation can't press the toolbar icon or the browser-level shortcut. Check the
 * shortcut itself by hand.
 *
 * Needs the dev stack in fixture mode (`NEMU_RESPONDER=fixture pnpm dev`). It first runs a
 * production `wxt build` into .output/chrome-mv3 pointed at the local Nemu Service and loads that:
 * the dev build in .output/chrome-mv3-dev registers its content script from the WXT dev server
 * instead of the manifest, so under Playwright no overlay ever appears. Run
 * `pnpm --filter extension verify`; add `-- --headed` to watch.
 */
import {
  momentOneRequest,
  momentOneResponse,
  momentThreeFollowUpResponse,
  momentThreeRequest,
  momentThreeResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type BrowserContext, chromium, type Locator, type Page } from "playwright-core";
import type { browser } from "wxt/browser";

import { cropRegion } from "../features/area-crop/lib/area-crop.ts";
import { OPEN_COMPOSER_MESSAGE } from "../features/composer/lib/open-composer-message.ts";
import { RING_PADDING } from "../features/highlight/lib/highlight-targets.ts";
import { CURSOR_OFFSET } from "../features/mascot/lib/mascot-position.ts";
import { ALLOWED_ORIGINS, DEFAULT_SERVER_URL } from "../shared/lib/config.ts";

const EXTENSION_ROOT = path.resolve(import.meta.dirname, "..");
const EXTENSION_DIR = path.join(EXTENSION_ROOT, ".output/chrome-mv3");
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, "../.output/verify");
const [DEMO_APP_URL = ""] = ALLOWED_ORIGINS;
// The Nemu Service's own origin is not on the allowlist, so it must get no overlay.
const OUTSIDE_URL = DEFAULT_SERVER_URL;
const TIMEOUT_MS = 15_000;
/** Pixels an Area Crop may differ from the page by; the mascot and two Composer buttons were ~550. */
const MAX_STRAY_PIXELS = 50;
// Issue #8: Momen 1 must succeed five times out of five.
const MOMEN_1_RUNS = 5;
// Issue #10: so must Momen 3, from Beranda to Kirim.
const MOMEN_3_RUNS = 5;
const SAMPLE_DOCUMENTS = path.resolve(import.meta.dirname, "../../mock-alurkerja/sample-documents");
const MISSING_UPLOADS = {
  "upload-laporan-perjalanan": "laporan-perjalanan-makassar.pdf",
  "upload-boarding-pass-pulang": "boarding-pass-pulang-upg-cgk.pdf",
} as const;

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

/** Drags `box` in area select mode, with a screenshot of the drag just before it is released. */
async function dragArea(page: Page, box: Box, screenshot: string) {
  await page.getByRole("button", { name: "Pilih area" }).click();
  await page.getByRole("application", { name: "Pilih area" }).waitFor();
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width, box.y + box.height, { steps: 5 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshot) });
  await page.mouse.up();
}

/** Drags a box over `targets` in area select mode, the way Rina selects the lodging field. */
async function selectArea(page: Page, targets: Locator[]): Promise<Box> {
  await targets[0]?.scrollIntoViewIfNeeded();
  const boxes = await Promise.all(targets.map(boxOf));
  const margin = 12;
  const left = Math.min(...boxes.map(({ x }) => x)) - margin;
  const top = Math.min(...boxes.map(({ y }) => y)) - margin;
  const right = Math.max(...boxes.map(({ x, width }) => x + width)) + margin;
  const bottom = Math.max(...boxes.map(({ y, height }) => y + height)) + margin;
  const selection = { x: left, y: top, width: right - left, height: bottom - top };
  await dragArea(page, selection, "momen-2-area-select.png");
  return selection;
}

/**
 * Compares the Area Crop with a screenshot of the same selection with Nemu's overlay taken out,
 * so whatever Nemu drew that ended up in the crop fails the check.
 */
async function assertCropShowsOnlyPage(page: Page, cropUrl: string, selection: Box) {
  // From inside the shadow root: WXT's `:host { all: initial !important }` beats any page style.
  const overlay = page.locator("nemu-overlay");
  await overlay.evaluate((host) => {
    const style = document.createElement("style");
    style.id = "verify-hide-nemu";
    style.textContent = "* { visibility: hidden !important; transition: none !important; }";
    host.shadowRoot?.append(style);
  });
  const clean = await page.screenshot();
  await overlay.evaluate((host) => host.shadowRoot?.getElementById("verify-hide-nemu")?.remove());
  // A PNG's IHDR holds its width and height at bytes 16 and 20.
  const { source } = cropRegion(
    { left: selection.x, top: selection.y, width: selection.width, height: selection.height },
    await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    { width: clean.readUInt32BE(16), height: clean.readUInt32BE(20) },
  );
  const differing = await page.evaluate(
    async ({ cropUrl, cleanUrl, source }) => {
      async function decode(url: string) {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }
      // Both drawn at the crop's own size, whatever scale either screenshot was taken at.
      const crop = await decode(cropUrl);
      const canvas = document.createElement("canvas");
      canvas.width = crop.naturalWidth;
      canvas.height = crop.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("no 2D canvas");
      const { width, height } = canvas;
      context.drawImage(crop, 0, 0);
      const cropPixels = context.getImageData(0, 0, width, height).data;
      const screenshot = await decode(cleanUrl);
      context.drawImage(
        screenshot,
        source.left,
        source.top,
        source.width,
        source.height,
        0,
        0,
        width,
        height,
      );
      const pagePixels = context.getImageData(0, 0, width, height).data;
      let differing = 0;
      for (let index = 0; index < cropPixels.length; index += 4) {
        const channels = [0, 1, 2].map((channel) =>
          Math.abs((cropPixels[index + channel] ?? 0) - (pagePixels[index + channel] ?? 0)),
        );
        if (Math.max(...channels) > 24) differing++;
      }
      return differing;
    },
    { cropUrl, cleanUrl: `data:image/png;base64,${clean.toString("base64")}`, source },
  );
  if (differing > MAX_STRAY_PIXELS) {
    throw new Error(`the Area Crop shows Nemu's own UI: ${differing} pixels differ from the page`);
  }
}

/** The newest Chat Log entry, read with Rina's Demo App session like the Admin Workspace does. */
async function newestChatLogEntry(page: Page): Promise<{ prompt: string; hasAreaCrop: boolean }> {
  const body = await page.evaluate(async (serverUrl) => {
    const response = await fetch(`${serverUrl}/rpc/listChatLog`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    return response.json();
  }, DEFAULT_SERVER_URL);
  const [entry] = body.json ?? [];
  if (!entry) throw new Error(`no Chat Log entry: ${JSON.stringify(body).slice(0, 200)}`);
  return entry;
}

async function closeAnswerCard(page: Page) {
  // The header's ×, not the Tutup link of a notice card or Rincian's "Tutup rincian".
  await page.getByRole("button", { name: "Tutup", exact: true }).first().click();
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

/** Checks that the overlay draws one ring, labelled `label`, around the target's box. */
async function assertOnlyRing(overlay: Locator, target: string, label: string, targetBox: Box) {
  const rings = overlay.locator("[data-nemu-highlight]");
  if ((await rings.count()) !== 1) throw new Error(`${await rings.count()} rings, not one`);
  // The label's text, without the mascot art beside it.
  const text = await rings
    .locator('[data-slot="badge"]')
    .evaluate((badge) =>
      Array.from(badge.childNodes, (node) =>
        node instanceof Element && node.hasAttribute("aria-hidden") ? "" : node.textContent,
      ).join(""),
    );
  if (text !== label) throw new Error(`no "${label}" label on ${target}`);
  if (!sameBox(await boxOf(rings), ringAround(targetBox))) {
    throw new Error(`the "${label}" ring isn't around ${target}`);
  }
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

/** The demo panel's reset puts PD-2026-0042 back in Pertanggungjawaban with two documents. */
async function resetDemoData(page: Page) {
  await page.goto(DEMO_APP_URL);
  await page.getByRole("button", { name: "Panel demo" }).click();
  await page.getByRole("button", { name: "Reset data demo" }).click();
  await page.getByText("Data demo dikembalikan", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
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

/** Builds the extension as it ships, but calling the local Nemu Service. */
function buildExtension() {
  execFileSync("pnpm", ["exec", "wxt", "build"], {
    cwd: EXTENSION_ROOT,
    env: { ...process.env, WXT_SERVER_URL: DEFAULT_SERVER_URL },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/**
 * Fails fast when the Nemu Service answers with the AI Responder: its answers never match the
 * fixtures, so every Momen check would otherwise wait out its timeout on the reading card.
 */
async function assertFixtureResponder(page: Page) {
  const { user_id: _userId, ...request } = momentOneRequest;
  const body = await page.evaluate(
    async ({ serverUrl, json }) => {
      const response = await fetch(`${serverUrl}/rpc/nemuChat`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json }),
      });
      return response.json();
    },
    { serverUrl: DEFAULT_SERVER_URL, json: request },
  );
  if (body.json?.answer?.ringkas !== momentOneResponse.answer.ringkas) {
    throw new Error(
      "the Nemu Service isn't answering from the fixtures. Restart it with NEMU_RESPONDER=fixture pnpm dev",
    );
  }
}

/** Beranda greets Rina by name in its page heading. */
async function waitForBeranda(page: Page) {
  await page.getByRole("heading", { level: 1, name: /^Good morning/ }).waitFor();
}

async function main() {
  await assertReachable(DEMO_APP_URL);
  await assertReachable(OUTSIDE_URL);
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  buildExtension();

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
      await waitForBeranda(page);
      await assertFixtureResponder(page);
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
          await waitForBeranda(page);
          await ask(context, page, momentOneRequest.prompt);
          await page.getByText(momentOneResponse.answer.ringkas).waitFor();
          // Morph (200 ms) and part of the move: the cursor is on its way to the menu.
          await page.waitForTimeout(400);
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-1-clicking.png") });
          }
          await page.waitForURL(`${DEMO_APP_URL}/perdin/baru`);
          await page.getByRole("button", { name: "Rincian", exact: true }).click();
          await page.getByText("Rincian perkiraan biaya", { exact: false }).waitFor();
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-1-form.png") });
          }
          await closeAnswerCard(page);
        }
      },
    );

    await check(
      "on the form, Momen 2 sends only the selected area, rings its targets one step at a time and the Answer Card avoids them",
      async () => {
        await page.goto(`${DEMO_APP_URL}/perdin/baru`);
        await page.getByRole("heading", { name: "Start Perjalanan Dinas" }).waitFor();
        // The lodging fields render only while the form's Biaya tab is open.
        await page.getByRole("tab", { name: "Biaya" }).click();
        const highlights = momentTwoResponse.actions.filter(({ type }) => type === "highlight");
        if (highlights.length === 0) throw new Error("momentTwoResponse has no highlight actions");

        await openComposer(context, page);
        const composer = page.getByRole("textbox", { name: "Pertanyaan untuk Nemu" });
        await composer.fill(momentTwoRequest.prompt);
        const selection = await selectArea(
          page,
          highlights.map(({ target }) => page.locator(`[data-nemu-id="${target}"]`).first()),
        );

        // The chip holds a crop of the selection alone, not of the whole viewport.
        const chip = page.getByRole("img", { name: "Area Crop" });
        await chip.waitFor();
        const [cropWidth, cropHeight, cropUrl] = await chip.evaluate((image: HTMLImageElement) => [
          image.naturalWidth,
          image.naturalHeight,
          image.src,
        ]);
        await writeFile(
          path.join(SCREENSHOT_DIR, "momen-2-area-crop-sent.png"),
          Buffer.from(String(cropUrl).replace(/^data:image\/png;base64,/, ""), "base64"),
        );
        const scale = await page.evaluate(() => window.devicePixelRatio);
        if (
          Math.abs((cropWidth ?? 0) - selection.width * scale) > 2 ||
          Math.abs((cropHeight ?? 0) - selection.height * scale) > 2
        ) {
          throw new Error(
            `the crop is ${cropWidth}×${cropHeight}, not the ${selection.width}×${selection.height} selection`,
          );
        }
        await assertCropShowsOnlyPage(page, String(cropUrl), selection);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-2-area-crop-chip.png") });
        await composer.press("Enter");

        const overlay = page.locator("nemu-overlay");
        const card = overlay
          .locator('[data-slot="card"]')
          .filter({ hasText: momentTwoResponse.answer.ringkas });
        await card.waitFor();
        for (const warning of momentTwoResponse.warnings) {
          await card.getByRole("list", { name: "Peringatan" }).getByText(warning).waitFor();
        }

        // One ring at a time: check each step, then move on with the Answer Card's arrow.
        for (const [index, { target, label }] of highlights.entries()) {
          await card.getByText(`Langkah ${index + 1} dari ${highlights.length}`).waitFor();
          await waitForScrollToSettle(page);
          await eventually(async () => {
            // The panel around the card, which scrolls when it's shrunk to keep off the ring.
            const cardBox = await boxOf(card.locator("xpath=../.."));
            const targetBox = await boxOf(page.locator(`[data-nemu-id="${target}"]`).first());
            await assertOnlyRing(overlay, target, label, targetBox);
            if (overlaps(cardBox, targetBox)) throw new Error(`the Answer Card covers ${target}`);
          });
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `momen-2-highlight-step-${index + 1}.png`),
          });
          if (index < highlights.length - 1) {
            await card.getByRole("button", { name: "Langkah berikutnya" }).click();
          }
        }
        for (const { judul, pasal } of momentTwoResponse.citations) {
          await card.getByRole("button", { name: judul }).click();
          if (pasal) await card.getByText(`Pasal ${pasal}`, { exact: false }).waitFor();
        }

        // Arahkan only: Rina fills the lodging fields herself.
        const [notHotel, amount] = highlights.map(({ target }) =>
          page.locator(`[data-nemu-id="${target}"]`).first(),
        );
        if ((await notHotel?.getAttribute("aria-checked")) === "true") {
          throw new Error("Nemu picked the lodging option");
        }
        const amountValue = await amount?.evaluate((element) =>
          element instanceof HTMLInputElement
            ? element.value
            : element.querySelector("input")?.value,
        );
        if (amountValue) throw new Error(`Nemu filled the lodging amount: ${amountValue}`);

        const entry = await newestChatLogEntry(page);
        if (entry.prompt !== momentTwoRequest.prompt || !entry.hasAreaCrop) {
          throw new Error(`the Chat Log doesn't record the Area Crop: ${JSON.stringify(entry)}`);
        }
      },
    );

    // Issue #121: the mascot and the Composer's buttons once showed up in the crop.
    await check("an Area Crop shows only the page, never what Nemu draws over it", async () => {
      await page.goto(DEMO_APP_URL);
      await waitForBeranda(page);
      await openComposer(context, page);
      // Almost the whole viewport, so the Composer and the mascot are inside the selection.
      const { width, height } = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      const selection = { x: 4, y: 4, width: width - 8, height: height - 8 };
      await dragArea(page, selection, "area-crop-viewport-select.png");
      const chip = page.getByRole("img", { name: "Area Crop" });
      await chip.waitFor();
      await assertCropShowsOnlyPage(page, String(await chip.getAttribute("src")), selection);
    });

    await check("the mascot follows the cursor and opens the Composer when clicked", async () => {
      await page.goto(DEMO_APP_URL);
      await waitForBeranda(page);
      const mascot = page.getByRole("button", { name: "Tanya Nemu" });
      // The overlay starts listening for the cursor a moment after the page renders, and the mascot
      // has no place until it sees the cursor move, so keep moving until it shows up.
      await eventually(async () => {
        await page.mouse.move(0, 0);
        await page.mouse.move(600, 400);
        await mascot.waitFor({ timeout: 200 });
      });
      await eventually(async () => {
        const box = await boxOf(mascot);
        if (
          Math.abs(box.x - 600 - CURSOR_OFFSET) > 1 ||
          Math.abs(box.y - 400 - CURSOR_OFFSET) > 1
        ) {
          throw new Error(`the mascot is at ${box.x},${box.y}, not beside the cursor`);
        }
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "mascot-idle.png") });
      await mascot.click();
      await page.getByRole("textbox", { name: "Pertanyaan untuk Nemu" }).waitFor();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "mascot-listening.png") });
      await page.keyboard.press("Escape");
    });

    await check(
      `Momen 3 opens the task, rings the uploads then Kirim, then shows Verifikasi, ${MOMEN_3_RUNS} out of ${MOMEN_3_RUNS}`,
      async () => {
        const overlay = page.locator("nemu-overlay");
        for (let run = 1; run <= MOMEN_3_RUNS; run++) {
          await resetDemoData(page);
          await page.goto(DEMO_APP_URL);
          await waitForBeranda(page);
          await ask(context, page, momentThreeRequest.prompt);
          await page.getByText(momentThreeResponse.answer.ringkas).waitFor();
          await page.waitForURL(`${DEMO_APP_URL}/perdin/task/PD-2026-0042`);

          // The follow-up from the task page: its own answer, the deadline chip, three steps.
          const card = overlay
            .locator('[data-slot="card"]')
            .filter({ hasText: momentThreeFollowUpResponse.answer.ringkas });
          await card.waitFor();
          await card.getByText("Batas 12 November 2026").waitFor();
          const steps = momentThreeFollowUpResponse.actions;
          const ringStep = async (index: number) => {
            const step = steps[index];
            if (!step) throw new Error(`momentThreeFollowUpResponse has no step ${index + 1}`);
            await card.getByText(`Langkah ${index + 1} dari ${steps.length}`).waitFor();
            await waitForScrollToSettle(page);
            await eventually(async () => {
              const targetBox = await boxOf(page.locator(`[data-nemu-id="${step.target}"]`));
              await assertOnlyRing(overlay, step.target, step.label, targetBox);
            });
          };
          await ringStep(0);
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-3-task.png") });
          }
          // Nemu never presses Kirim: the task is still open until Rina does.
          await page.locator(`[data-nemu-id="button-kirim"]`).waitFor();

          // Each upload moves the ring on by itself, ending on Kirim.
          for (const [index, [nemuId, file]] of Object.entries(MISSING_UPLOADS).entries()) {
            await page
              .locator(`[data-nemu-id="${nemuId}"]`)
              .setInputFiles(path.join(SAMPLE_DOCUMENTS, file));
            // The file name under the field appears once the refetch shows the upload.
            await page.getByText(file, { exact: true }).waitFor();
            await ringStep(index + 1);
          }
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-3-kirim.png") });
          }
          await page.locator('[data-nemu-id="button-kirim"]').click();

          const status = card.getByRole("region", { name: "Status tugas" });
          await status.getByText("PJ-PD-2026-0042").waitFor();
          await status.getByText("Verifikasi", { exact: true }).waitFor();
          if (run === 1) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, "momen-3-sent.png") });
          }
          await closeAnswerCard(page);
        }
      },
    );
  } finally {
    await context.close();
  }

  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  if (failed) process.exitCode = 1;
}

await main();
