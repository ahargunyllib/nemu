// Loads a production build of the extension into Playwright's Chromium and checks F2 "Nemu, ini
// kenapa?" (#205, #216) end to end on the mocks with the official Kamus Kendala: F2-2 (AlurSekolah,
// IPAS 4A not assigned → Pak Rizal, Kamus Kendala K-07, a WhatsApp Web link, never sent), F2-3 (Ruang GTK → cara 2 points at
// E-Kinerja, then Sinkro Ruang GTK; the teacher clicks; no WhatsApp), an error the guide doesn't
// cover (an offer to message the operator) and the password guard.
// Playwright's clicks are real (isTrusted) input. web.whatsapp.com is answered locally, so nothing
// reaches WhatsApp. Needs `NEMU_RESPONDER=fixture pnpm dev` running. Screenshots: .output/verify-f2/.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const RUANG_GTK = process.env.MOCK_RUANG_GTK_URL ?? "http://localhost:3004/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f2");
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
  viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// Never reach WhatsApp: the link is only opened and read.
await context.route("https://web.whatsapp.com/**", (route) =>
  route.fulfill({ contentType: "text/html", body: "<title>WhatsApp (uji)</title>" }),
);
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;

const settings = await context.newPage();
await settings.goto(`chrome-extension://${extensionId}/options.html`);
await settings.getByLabel("Kode pemasangan sekolah").fill(INSTALL_CODE);
await settings.getByRole("button", { name: "Simpan" }).click();
await settings.getByText(/^Terpasang untuk /u).waitFor();
await settings.close();
for (const open of context.pages()) if (open.url().includes("welcome")) await open.close();

const overlay = (page) => page.locator("nemu-overlay");
const bubble = (page) => overlay(page).getByRole("region", { name: "Jawaban Nemu" });
const display = (page, type) => overlay(page).locator(`[data-nemu-display='${type}']`);
async function ask(page, question) {
  const closed = overlay(page).locator("button[aria-label='Tanya Nemu']");
  await closed.or(overlay(page).locator("button[aria-label='Tutup Nemu']")).waitFor({
    timeout: 10_000,
  });
  if (await closed.count()) await closed.click();
  await overlay(page).getByLabel("Pertanyaan untuk Nemu").fill(question);
  await overlay(page).getByRole("button", { name: "Kirim" }).click();
}

const page = await context.newPage();
await page.goto(new URL("#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

await check("captureVisibleTab from the service worker on an allowed site", async () => {
  // Not a pass/fail of F2: it records whether Chrome gives the screenshot without activeTab.
  const result = await worker.evaluate(async () => {
    try {
      const shot = await chrome.tabs.captureVisibleTab({ format: "jpeg", quality: 70 });
      return `captured ${Math.round(shot.length / 1024)} KB`;
    } catch (error) {
      return `refused: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  console.log(`  ${result}`);
});

await check(
  "F2-2: IPAS 4A on AlurSekolah → not her fault, Pak Rizal, Kamus Kendala K-07",
  async () => {
    await page.locator("#menu-nilai").click();
    await page.locator("#pilih-kelas").selectOption("4A");
    await page.locator("#pilih-mapel").selectOption("IPAS");
    await page.locator("#pilih-jenis").selectOption("UTS");
    await page.locator("#btn-tampilkan").click();
    await page.getByText("Anda belum ditugaskan mengampu IPAS di kelas 4A").waitFor();
    await ask(page, "Nemu, ini kenapa?");
    await bubble(page)
      .getByText("Bukan kesalahan Ibu. Yang bisa membantu: Pak Rizal.")
      .waitFor({ timeout: 15_000 });
    await bubble(page).getByText("Pak Rizal operator sekolah.").waitFor();
    await bubble(page).getByRole("button", { name: "Kenapa?" }).click();
    await bubble(page)
      .getByText("Penugasan guru per mapel dan kelas diatur admin sekolah", { exact: false })
      .waitFor();
    await bubble(page).getByRole("button", { name: "Sumber" }).click();
    await bubble(page).getByText("Kamus Kendala · K-07", { exact: false }).waitFor();
    await page.screenshot({ path: join(shots, "f2-2-answer.png") });
  },
);

await check("F2-2: the button opens WhatsApp Web to Pak Rizal with the polite text", async () => {
  const [whatsapp] = await Promise.all([
    context.waitForEvent("page"),
    bubble(page).getByRole("button", { name: "Buka WhatsApp ke Pak Rizal" }).click(),
  ]);
  await whatsapp.waitForLoadState();
  const url = new URL(whatsapp.url());
  const text = url.searchParams.get("text") ?? "";
  console.log(`  ${url.origin}${url.pathname}?phone=${url.searchParams.get("phone")}`);
  console.log(`  text: ${text}`);
  expect(`${url.origin}${url.pathname}` === "https://web.whatsapp.com/send", "not WhatsApp Web");
  expect(url.searchParams.get("phone") === "6281200001003", "not Pak Rizal's number");
  expect(text.startsWith("Assalamualaikum Pak Rizal."), "the greeting is missing");
  expect(text.includes("Anda belum ditugaskan mengampu IPAS di kelas 4A"), "no error text");
  expect(text.includes("menambahkan penugasan guru"), "no request from Kamus Kendala K-07");
  expect(!/screenshot/iu.test(text), "the message promises a screenshot");
  await whatsapp.close();
});

const gtk = await context.newPage();
await check("F2-3: Ruang GTK → Nemu offers cara 2, with no WhatsApp", async () => {
  await gtk.goto(new URL("#/kinerja", RUANG_GTK).href);
  await gtk.getByText("gagal dialirkan ke E-Kinerja", { exact: false }).waitFor();
  await ask(gtk, "ini kenapa?");
  await bubble(gtk)
    .getByText("Ibu bisa memperbaikinya sendiri, saya tunjukkan caranya.")
    .waitFor({ timeout: 15_000 });
  await bubble(gtk).getByRole("button", { name: "Sumber" }).click();
  await bubble(gtk).getByText("Kamus Kendala · K-02", { exact: false }).waitFor();
  expect(
    (await bubble(gtk)
      .getByRole("button", { name: /WhatsApp/u })
      .count()) === 0,
    "a WhatsApp button shows for an error she can fix",
  );
  await gtk.screenshot({ path: join(shots, "f2-3-answer.png") });
});

await check("F2-3: Nemu points at E-Kinerja, then Sinkro Ruang GTK; she clicks", async () => {
  await bubble(gtk).getByRole("button", { name: "Tunjukkan caranya", exact: true }).click();
  await display(gtk, "tunjuk").getByText("Klik E-Kinerja.").waitFor({ timeout: 10_000 });
  await gtk.screenshot({ path: join(shots, "f2-3-point-menu.png") });
  await gtk.locator("#menu-e-kinerja").click();
  await display(gtk, "tunjuk").getByText("Klik Sinkro Ruang GTK.").waitFor({ timeout: 10_000 });
  await gtk.screenshot({ path: join(shots, "f2-3-point-sinkro.png") });
  expect(
    (await gtk.locator("#status-user-gtk").innerText()) === "Belum ditandai",
    "Nemu pressed Sinkro itself",
  );
  await gtk.locator("#btn-sinkro-ruang-gtk").click();
  await gtk.getByText("Sinkronisasi berhasil", { exact: false }).waitFor();
  // Catatan langkah names the Kamus Kendala entry and what she pressed.
  const notes = display(gtk, "info");
  await notes.getByText("Sumber: Kamus Kendala K-02").waitFor({ timeout: 10_000 });
  await notes.getByText("menekan Sinkro Ruang GTK", { exact: false }).waitFor();
  await gtk.screenshot({ path: join(shots, "f2-3-notes.png") });
  await notes.getByRole("button", { name: "Tutup" }).click();
});

await check("not in the guide: says so and offers to message Pak Rizal", async () => {
  await gtk.goto(new URL("#/data-saya", RUANG_GTK).href);
  await ask(gtk, "ini kenapa?");
  await bubble(gtk)
    .getByText("Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?")
    .waitFor({ timeout: 15_000 });
  const [whatsapp] = await Promise.all([
    context.waitForEvent("page"),
    bubble(gtk).getByRole("button", { name: "Ya, tanyakan ke Pak Rizal" }).click(),
  ]);
  expect(
    new URL(whatsapp.url()).searchParams.get("phone") === "6281200001003",
    "not Pak Rizal's number",
  );
  await whatsapp.close();
  await gtk.screenshot({ path: join(shots, "not-in-guide.png") });
});

await check("a password field on screen: Nemu reads and sends nothing", async () => {
  await gtk.goto(new URL("#/kinerja", RUANG_GTK).href);
  // The mock has no password field on this page; add one as a portal's re-login box would.
  await gtk.evaluate(() => {
    const box = document.createElement("label");
    box.textContent = "Kata sandi ";
    box.append(Object.assign(document.createElement("input"), { type: "password" }));
    document.querySelector("#app")?.prepend(box);
  });
  await ask(gtk, "ini kenapa?");
  await bubble(gtk)
    .getByText("Ada kolom kata sandi di layar", { exact: false })
    .waitFor({ timeout: 15_000 });
  await gtk.screenshot({ path: join(shots, "password-guard.png") });
});

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
