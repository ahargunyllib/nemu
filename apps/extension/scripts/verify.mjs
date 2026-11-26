// Loads a production build of the extension into Playwright's Chromium and checks #199 end to
// end: the install code, the Nemu button on allowed sites only, identity from the page email, and
// a typed question answered through helpRoute. Needs `NEMU_RESPONDER=fixture pnpm dev` running.
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
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
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
    await bubble(page).getByText("SOP Penilaian SDIT Nusantara", { exact: false }).waitFor({
      timeout: 15_000,
    });
    expect((await bubble(page).innerText()).includes("75"), "the answer doesn't name the KKM");
    await page.screenshot({ path: join(shots, "answer.png") });
  },
);

await check("switching to an unregistered account shows the operator to contact", async () => {
  await signIn("rizal.operator");
  await openNemu(page);
  await bubble(page).getByText("Akun ini belum didaftarkan. Hubungi Pak Rizal.").waitFor({
    timeout: 10_000,
  });
  await page.screenshot({ path: join(shots, "unregistered.png") });
});

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
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
