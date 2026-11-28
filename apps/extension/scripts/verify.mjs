// Loads a production build of the extension into Playwright's Chromium and checks #199 and #200 end
// to end: the install code, the Nemu button on allowed sites only, identity from the page email
// (an unregistered account gets a WhatsApp message to the operator, ID-02; web.whatsapp.com is
// answered locally, so nothing is sent), a typed question answered through helpRoute, and holding
// Ctrl + Space (or the Nemu button) to talk with a fake microphone. #268: unclear words are shown back, not acted on; and in a second, headed
// window without the auto-answer flag, the first hold points at Chrome's real prompt, refusing or
// blocking the microphone shows the three steps, and talking works once it is allowed and the page
// reloaded (#280).
// Needs `NEMU_RESPONDER=fixture pnpm dev` running.
// Screenshots go to .output/verify/. Every URL can be overridden, e.g. to use the deployed mocks:
//   MOCK_ALURSEKOLAH_URL=https://nemu-alursekolah.ahargunyllib.dev/ pnpm --filter extension verify
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const RUANG_GTK = process.env.MOCK_RUANG_GTK_URL ?? "http://localhost:3004/";
const ERAPOR = process.env.MOCK_ERAPOR_URL ?? "http://localhost:3005/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify");
mkdirSync(shots, { recursive: true });

execFileSync("pnpm", ["exec", "wxt", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WXT_SERVER_URL: SERVER },
});

let failed = false;
async function check(name, run) {
  try {
    await run();
    console.log(`✔ ${name}`);
  } catch (error) {
    failed = true;
    // What each open tab showed when the check failed.
    for (const [index, open] of context.pages().entries())
      await open
        .screenshot({ path: join(shots, `failed-${name.slice(0, 24)}-${index}.png`) })
        .catch(() => undefined);
    console.log(`✘ ${name}\n  ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "nemu-")), {
  headless: !HEADED,
  channel: "chromium",
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    // A fake microphone that plays a tone, with its permission prompt answered "Izinkan".
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
// Never reach WhatsApp: the operator link (ID-02) is only opened and read.
await context.route("https://web.whatsapp.com/**", (route) =>
  route.fulfill({ contentType: "text/html", body: "<title>WhatsApp (uji)</title>" }),
);
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;

const overlay = (page) => page.locator("nemu-overlay");
const nemuButton = (page) =>
  overlay(page).locator("button[aria-label='Tanya Nemu'], button[aria-label='Tutup Nemu']");
async function openNemu(page) {
  await nemuButton(page).waitFor({ timeout: 10_000 });
  const closed = overlay(page).locator("button[aria-label='Tanya Nemu']");
  if (await closed.count()) await closed.click();
}
const bubble = (page) => overlay(page).getByRole("region", { name: "Jawaban Nemu" });

await check("the settings page refuses an unknown install code and keeps a valid one", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByLabel("Kode pemasangan sekolah").fill("SALAH-123");
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.getByText("Kode pemasangan tidak dikenal").waitFor();
  await page.getByLabel("Kode pemasangan sekolah").fill(INSTALL_CODE.toLowerCase());
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.getByText("Situs yang diizinkan").waitFor();
  await page.getByText(/^Terpasang untuk /u).waitFor();
  await page.screenshot({ path: join(shots, "settings.png"), fullPage: true });
  await page.close();
});

const page = await context.newPage();
async function signIn(user) {
  await page.goto(new URL("#/keluar", MOCK).href);
  await page.locator("#username").fill(user);
  await page.locator("#password").fill("nemu-uji-2026");
  await page.locator("#btn-masuk").click();
  await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();
}

await check("the Nemu button and its hint show on the mock AlurSekolah", async () => {
  await signIn("siti.aminah");
  await nemuButton(page).waitFor({ timeout: 10_000 });
  await overlay(page).getByText("untuk bicara").waitFor();
  await page.screenshot({ path: join(shots, "nemu-button.png") });
});

await check(
  "Bu Siti's typed question comes back as a Gelembung Jawab with its source",
  async () => {
    await openNemu(page);
    await overlay(page).getByLabel("Pertanyaan untuk Nemu").fill("KKM nilai berapa?");
    await overlay(page).getByRole("button", { name: "Kirim" }).click();
    // The source is behind the Sumber link (#201): read only once it is clicked.
    await bubble(page).getByRole("button", { name: "Sumber" }).click({ timeout: 15_000 });
    await bubble(page).getByText("SOP Penilaian SDIT Nusantara", { exact: false }).waitFor();
    expect((await bubble(page).innerText()).includes("75"), "the answer doesn't name the KKM");
    await page.screenshot({ path: join(shots, "answer.png") });
  },
);

await check("the welcome page says how to talk and that Chrome asks the first time", async () => {
  const welcome = await context.newPage();
  await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
  await welcome.getByText("sambil bicara, lalu lepaskan", { exact: false }).waitFor();
  await welcome.getByText("Chrome meminta izin mikrofon", { exact: false }).waitFor();
  expect(
    (await welcome.getByRole("button", { name: "Izinkan mikrofon" }).count()) === 0,
    "the welcome page still asks for the microphone",
  );
  await welcome.screenshot({ path: join(shots, "welcome.png"), fullPage: true });
  await welcome.close();
});

// The fixture school AI hears "masukkan nilai UTS Matematika 4B" whatever the microphone gives.
const HEARD = "masukkan nilai UTS Matematika 4B";
const heardBubble = (target) => overlay(target).getByRole("region", { name: "Yang Nemu dengar" });

await check(
  "holding Ctrl + Space shows Nemu mendengar…, then what Nemu heard, then speaks the answer",
  async () => {
    await page.bringToFront();
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.down("Control");
    await page.keyboard.down("Space");
    await overlay(page).getByText("Nemu mendengar…").waitFor({ timeout: 5_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: join(shots, "listening.png") });
    await page.keyboard.up("Space");
    await page.keyboard.up("Control");
    await heardBubble(page).getByText(HEARD).waitFor({ timeout: 15_000 });
    // A grade request goes to F1 (#207); with no photo yet, Nemu asks for one over WhatsApp.
    await bubble(page)
      .getByText(/Kirim foto buku nilai UTS Matematika 4B ke WhatsApp Nemu/u)
      .waitFor({ timeout: 15_000 });
    await bubble(page).locator("[data-nemu-spoken]").first().waitFor({ timeout: 5_000 });
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: join(shots, "speaking.png") });
  },
);

await check("pressing and holding the Nemu button talks too", async () => {
  await page.keyboard.press("Escape");
  const box = await nemuButton(page).boundingBox();
  expect(box, "the Nemu button has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await overlay(page).getByText("Nemu mendengar…").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(800);
  await page.mouse.up();
  await heardBubble(page).getByText(HEARD).waitFor({ timeout: 15_000 });
});

/** Holds Ctrl + Space for `ms`, then lets go. */
async function holdToTalk(target, ms = 1_000) {
  await target.bringToFront();
  await target.keyboard.down("Control");
  await target.keyboard.down("Space");
  await target.waitForTimeout(ms);
  await target.keyboard.up("Space");
  await target.keyboard.up("Control");
}

await check(
  "ID-02: an unregistered account gets the sentence and a WhatsApp message to the operator",
  async () => {
    await signIn("rizal.operator");
    await openNemu(page);
    await bubble(page).getByText("Akun Ibu belum didaftarkan di Nemu.").waitFor({
      timeout: 10_000,
    });
    expect(
      (await overlay(page).getByLabel("Pertanyaan untuk Nemu").count()) === 0,
      "an unregistered account still has the type box",
    );
    await page.screenshot({ path: join(shots, "unregistered.png") });

    const [whatsapp] = await Promise.all([
      context.waitForEvent("page"),
      bubble(page).getByRole("button", { name: "Siapkan pesan WA ke operator" }).click(),
    ]);
    await whatsapp.waitForLoadState();
    const url = new URL(whatsapp.url());
    const text = url.searchParams.get("text") ?? "";
    console.log(`  ${url.origin}${url.pathname}?phone=${url.searchParams.get("phone")}`);
    console.log(`  text: ${JSON.stringify(text)}`);
    expect(`${url.origin}${url.pathname}` === "https://web.whatsapp.com/send", "not WhatsApp Web");
    expect(url.searchParams.get("phone") === "6281200001003", "not Pak Rizal's number (WS-06)");
    expect(text.startsWith("Assalamualaikum Pak Rizal."), "the greeting is missing");
    expect(text.includes("Mohon daftarkan akun saya di Nemu."), "no request to be registered");
    expect(text.includes("rizal.operator@sditnusantara.sch.id"), "no account email");
    expect(text.includes(`Halaman: Beranda (${new URL(MOCK).origin}/`), "no page");
    // Nemu only opens the chat; the teacher presses Kirim. The mock page stays as it was.
    expect(!page.isClosed(), "the AlurSekolah page was closed");
    await whatsapp.close();
  },
);

await check("switching back to a registered teacher brings the type box back", async () => {
  await signIn("dewi.lestari");
  await openNemu(page);
  await overlay(page).getByLabel("Pertanyaan untuk Nemu").waitFor({ timeout: 10_000 });
});

await check("Ruang GTK, on the list but without an account, asks as the last teacher", async () => {
  const gtk = await context.newPage();
  await gtk.goto(RUANG_GTK);
  await openNemu(gtk);
  await overlay(gtk).getByLabel("Pertanyaan untuk Nemu").waitFor({ timeout: 10_000 });
  await gtk.close();
});

await check("WS-1 (a): e-Rapor, off the WS-03 list, gets no Nemu button", async () => {
  const erapor = await context.newPage();
  await erapor.goto(ERAPOR);
  await erapor.waitForTimeout(2_500);
  expect((await overlay(erapor).count()) === 0, "a Nemu overlay was mounted on e-Rapor");
  await erapor.screenshot({ path: join(shots, "erapor.png") });
  await erapor.close();
});

await context.close();

// #268 in a window of its own: Chrome's real prompt only shows in a headed browser without
// --use-fake-ui-for-media-stream. Playwright can't press Chrome's buttons, so the checks answer
// through the permission itself, as Izinkan, Jangan izinkan or the site settings would.
const micContext = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "nemu-")), {
  headless: false,
  channel: "chromium",
  viewport: { width: 1280, height: 720 },
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--use-fake-device-for-media-stream",
  ],
});
const micWorker =
  micContext.serviceWorkers()[0] ?? (await micContext.waitForEvent("serviceworker"));
const micExtensionId = new URL(micWorker.url()).host;
const origin = new URL(MOCK).origin;
const mic = await micContext.newPage();
const cdp = await micContext.newCDPSession(mic);
const setMicrophone = (setting, at = origin) =>
  cdp.send("Browser.setPermission", { permission: { name: "microphone" }, setting, origin: at });
const pointerOn = (target) => overlay(target).getByRole("region", { name: "Petunjuk Nemu" });
const stepsOn = (target) =>
  overlay(target).getByRole("region", { name: "Nemu belum bisa mendengar Ibu." });
const pointer = pointerOn(mic);
const steps = stepsOn(mic);

/** A hold before the teacher is known only opens the panel, so wait for her type box first. */
async function untilRegistered(target = mic) {
  await openNemu(target);
  await overlay(target).getByLabel("Pertanyaan untuk Nemu").waitFor({ timeout: 10_000 });
}

async function micCheck(name, run) {
  await check(name, async () => {
    try {
      await run();
    } catch (error) {
      await mic.screenshot({ path: join(shots, `failed-mic-${name.slice(0, 24)}.png`) });
      throw error;
    }
  });
}

await micCheck("the first hold on a site points at Izinkan in Chrome's prompt", async () => {
  const settingsPage = await micContext.newPage();
  await settingsPage.goto(`chrome-extension://${micExtensionId}/options.html`);
  await settingsPage.getByLabel("Kode pemasangan sekolah").fill(INSTALL_CODE);
  await settingsPage.getByRole("button", { name: "Simpan" }).click();
  await settingsPage.getByText(/^Terpasang untuk /u).waitFor();
  await settingsPage.close();
  for (const open of micContext.pages()) if (open.url().includes("welcome")) await open.close();

  await mic.goto(new URL("#/keluar", MOCK).href);
  await mic.locator("#username").fill("siti.aminah");
  await mic.locator("#password").fill("nemu-uji-2026");
  await mic.locator("#btn-masuk").click();
  await mic.locator("#menu-email").filter({ hasText: "@" }).waitFor();
  await untilRegistered();

  await holdToTalk(mic, 600);
  await pointer.getByText("Klik Izinkan, Bu.", { exact: true }).waitFor({ timeout: 5_000 });
  // Chrome shows two Izinkan; only the top one lasts beyond this visit (ADR-0019).
  await pointer.getByText("Pilih Izinkan yang paling atas", { exact: false }).waitFor();
  await pointer.getByText("Giliran Ibu", { exact: true }).waitFor();
  // She let go to press Izinkan: Nemu keeps pointing until Chrome has an answer.
  const cursor = overlay(mic).locator("[data-nemu-cursor='arrived']");
  await cursor.waitFor();
  const x = Number(await cursor.getAttribute("data-x"));
  const y = Number(await cursor.getAttribute("data-y"));
  // Right of the prompt (it ends 447 px in), level with its top button (≈ 214–250 px down, less
  // the bars above the page in this window).
  expect(x > 447 && x < 480, `the cursor stands at x=${x}, not just right of Chrome's prompt`);
  expect(y > 100 && y < 260, `the cursor stands at y=${y}, not level with Izinkan`);
  await mic.waitForTimeout(500);
  await mic.screenshot({ path: join(shots, "mic-pointing.png") });

  await setMicrophone("granted");
  await bubble(mic)
    .getByText("Mikrofon sudah siap. Tahan lagi tombolnya sambil bicara, Bu.")
    .waitFor({ timeout: 5_000 });
  expect((await pointer.count()) === 0, "Nemu still points after the microphone was allowed");
  await mic.screenshot({ path: join(shots, "mic-ready.png") });
});

// Before any grade request: a grade-book question waiting for its answer would take the words.
await micCheck(
  "unclear words are shown back with a request to repeat, and nothing is done",
  async () => {
    // The fixture always hears a grade request; here the school AI catches only "nilai".
    // Answered here in oRPC's response shape; the request never reaches the Nemu Service.
    await micContext.route("**/rpc/speechTranscribe**", (route) =>
      route.fulfill({ status: 200, json: { json: { text: "nilai" } } }),
    );
    try {
      // Chrome still holds the first request, answered through the permission rather than its
      // button; a reload clears it, as pressing Izinkan would.
      await mic.reload();
      await untilRegistered();
      await holdToTalk(mic);
      const unclear = bubble(mic);
      await unclear
        .getByText("Maaf, Bu. Nemu belum dengar jelas.", { exact: true })
        .waitFor({ timeout: 15_000 });
      await unclear.getByText("Belum jelas", { exact: true }).waitFor();
      await unclear
        .getByText('Terdengar: "nilai". Tahan Ctrl + Spasi lagi, lalu ulangi lebih dekat.', {
          exact: true,
        })
        .waitFor();
      expect((await unclear.getByRole("button").count()) === 0, "the unclear bubble has a button");
      await mic.waitForTimeout(1_500);
      expect(
        (await overlay(mic)
          .getByText(/foto buku nilai|Nilai .+: \d+\?/u)
          .count()) === 0,
        "Nemu acted on the unclear words",
      );
      expect((await heardBubble(mic).count()) === 0, "the words also showed as heard");
      await mic.screenshot({ path: join(shots, "mic-unclear.png") });
    } finally {
      await micContext.unroute("**/rpc/speechTranscribe**");
    }
  },
);

// On Ruang GTK, a site of its own that Chrome hasn't asked about yet: after the answers given
// through the permission above, Chrome quietly closes further prompts on AlurSekolah.
await micCheck("refusing in Chrome's prompt shows the three steps", async () => {
  const gtk = await micContext.newPage();
  await gtk.goto(RUANG_GTK);
  await untilRegistered(gtk);
  await holdToTalk(gtk, 600);
  await pointerOn(gtk).waitFor({ timeout: 5_000 });
  await setMicrophone("denied", new URL(RUANG_GTK).origin);
  await stepsOn(gtk).waitFor({ timeout: 5_000 });
  expect((await pointerOn(gtk).count()) === 0, "Nemu still points after the refusal");
  await gtk.screenshot({ path: join(shots, "mic-refused.png") });
  await gtk.close();
});

await micCheck(
  "a blocked microphone shows three steps with only Tutup, and talking works once allowed",
  async () => {
    await setMicrophone("denied");
    await mic.reload();
    await untilRegistered();
    await holdToTalk(mic, 600);
    await steps.waitFor({ timeout: 5_000 });
    expect((await steps.getByRole("listitem").count()) === 3, "the card doesn't show three steps");
    await steps.getByText("Mikrofon terblokir", { exact: true }).waitFor();
    await steps
      .getByText("Mikrofon tidak diizinkan. Buka lagi dengan 3 langkah ini:", { exact: true })
      .waitFor();
    await steps.getByText("Klik ikon di kiri alamat situs", { exact: true }).waitFor();
    await steps.getByText("Pada Mikrofon, pilih Izinkan", { exact: true }).waitFor();
    // The steps end with reloading, as Chrome's own bar asks after the change (#280).
    await steps.getByText("Klik Muat ulang di bagian atas", { exact: true }).waitFor();
    const buttons = await steps.getByRole("button").allInnerTexts();
    expect(
      buttons.length === 1 && buttons[0].trim() === "Tutup",
      `the card has buttons ${JSON.stringify(buttons)}, not only Tutup`,
    );
    await mic.screenshot({ path: join(shots, "mic-blocked.png") });
    await steps.getByRole("button", { name: "Tutup" }).click();
    await steps.waitFor({ state: "detached" });

    // She followed the steps: allowed it, then reloaded the page.
    await setMicrophone("granted");
    await mic.reload();
    await untilRegistered();
    await holdToTalk(mic);
    await heardBubble(mic).getByText(HEARD).waitFor({ timeout: 15_000 });
  },
);

await micContext.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
