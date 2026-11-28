// Loads a development build of the extension into Playwright's Chromium and checks the executor
// (#202) on the mock AlurSekolah through its dev-only dock (`?uji-nemu`): cara 1 visible
// navigation and fill that stops at Simpan, the teacher's own click stopping Nemu (F0-07), a page
// load mid-task, Berhenti asking whether she fills the rest herself (F0-11), F0-1 (Muat respons
// uji), F0-09 (Koneksi putus), and Catatan langkah.
// Playwright's clicks are real (isTrusted) input. Needs `NEMU_RESPONDER=fixture pnpm dev` running.
// Screenshots go to .output/verify-executor/.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const extension = join(root, ".output/verify-executor-extension");
const shots = join(root, ".output/verify-executor");
mkdirSync(shots, { recursive: true });

// The dock exists only in development builds; copy the build so `wxt dev` can't change it mid-run.
execFileSync("pnpm", ["exec", "wxt", "build", "--mode", "development"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WXT_SERVER_URL: SERVER },
});
rmSync(extension, { recursive: true, force: true });
cpSync(join(root, ".output/chrome-mv3-dev"), extension, { recursive: true });

let failed = false;
async function check(name, run) {
  try {
    await run();
    console.log(`✔ ${name}`);
  } catch (error) {
    failed = true;
    await page
      .screenshot({ path: join(shots, `failed-${name.slice(0, 24)}.png`) })
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
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;

const settings = await context.newPage();
await settings.goto(`chrome-extension://${extensionId}/options.html`);
await settings.getByLabel("Kode pemasangan sekolah").fill(INSTALL_CODE);
await settings.getByRole("button", { name: "Simpan" }).click();
await settings.getByText(/^Terpasang untuk /u).waitFor();
await settings.close();
for (const open of context.pages()) if (open.url().includes("welcome")) await open.close();

const page = await context.newPage();
const overlay = page.locator("nemu-overlay");
const dock = overlay.getByLabel("Uji executor Nemu");
const display = (type) => overlay.locator(`[data-nemu-display='${type}']`);
const grade = (name) => page.getByLabel(`Nilai ${name}`, { exact: true });

async function openTestPage() {
  await page.goto(new URL("?uji-nemu#/keluar", MOCK).href);
  await page.locator("#username").fill("siti.aminah");
  await page.locator("#password").fill("nemu-uji-2026");
  await page.locator("#btn-masuk").click();
  await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();
  await dock.waitFor({ timeout: 10_000 });
}
await openTestPage();

await check(
  "cara 1 opens Nilai with the cursor, fills digit by digit, and stops at Simpan",
  async () => {
    await page.locator("#menu-beranda").click();
    await dock.getByRole("button", { name: "Contoh cara 1" }).click();
    // Visible navigation: the menu is clicked (the hash changes), not opened by URL.
    await display("kerja").getByText("Membuka Nilai…").waitFor({ timeout: 5_000 });
    await page.waitForURL(/#\/nilai$/u, { timeout: 5_000 });
    // The heading counts the students (5), not the values and notes Nemu types.
    await display("kerja")
      .locator("[data-nemu-status]")
      .filter({ hasText: "Nemu mengisi" })
      .filter({ hasText: /\d dari 5/u })
      .waitFor({ timeout: 15_000 });
    await page.screenshot({ path: join(shots, "cara-1-filling.png") });
    await display("tunjuk").getByText("Silakan tekan Simpan.").waitFor({ timeout: 30_000 });
    expect((await grade("Ahmad Fadli").inputValue()) === "80", "Ahmad Fadli wasn't filled");
    expect((await grade("Budi Santoso").inputValue()) === "85", "Budi Santoso wasn't filled");
    expect(
      (await page.getByLabel("Catatan Bagas Saputra").inputValue()) === "remedial",
      "Bagas Saputra's note wasn't filled",
    );
    expect((await overlay.locator("[data-nemu-tick]").count()) >= 6, "the rows aren't ticked");
    expect(!(await page.locator("#konfirmasi").isVisible()), "Simpan was pressed");
    await page.screenshot({ path: join(shots, "cara-1-simpan.png") });
  },
);

await check(
  "the teacher presses Simpan; Catatan langkah follows and reopens from the Nemu button",
  async () => {
    await page.locator("#btn-simpan").click();
    await page.locator("#ya-simpan").click();
    await page.getByText("Nilai tersimpan.").waitFor();
    const notes = overlay.getByRole("region", { name: "Catatan langkah" });
    await notes.getByText("Nemu mengisi 6 isian").waitFor({ timeout: 5_000 });
    await notes.getByText("Bu menekan Simpan").waitFor();
    await notes.getByRole("button", { name: "Coba sendiri" }).waitFor();
    await page.screenshot({ path: join(shots, "catatan-langkah.png") });
    await notes.getByRole("button", { name: "Tutup" }).click();
    await overlay.getByRole("button", { name: "Tanya Nemu" }).click();
    await overlay.getByRole("button", { name: "Lihat catatan langkah" }).click();
    await notes.waitFor();
    await notes.getByRole("button", { name: "Tutup" }).click();
  },
);

await check("F0-07: the teacher's own click stops Nemu and asks how to go on", async () => {
  await dock.getByRole("button", { name: "Contoh cara 1" }).click();
  await display("kerja")
    .getByText(/Nemu mengisi/u)
    .waitFor({ timeout: 15_000 });
  await page.locator("h1").click();
  const card = display("pilih");
  await card.getByText("Ibu mau isi sendiri?").waitFor({ timeout: 3_000 });
  // F1·08: grey Nemu berhenti, with the row Nemu was on once it fills rows.
  await card
    .locator("[data-nemu-status]")
    .filter({ hasText: /^Nemu berhenti(\d dari 5)?$/u })
    .waitFor();
  await card.getByText("Pilih salah satu, Nemu menunggu.").waitFor();
  for (const choice of ["Ya, saya isi sendiri", "Nemu saja yang lanjut", "Berhenti"])
    await card.getByRole("button", { name: choice }).waitFor();
  await page.screenshot({ path: join(shots, "f0-07-kartu-pilih.png") });
  // Ya, saya isi sendiri: cara 2 from the same step; values already right are passed over, and Nemu
  // points at the first field still to fill and says its value.
  await card.getByRole("button", { name: "Ya, saya isi sendiri" }).click();
  await display("tunjuk")
    .getByText(/^(Klik|Ketik|Pilih|Silakan) /u)
    .waitFor({ timeout: 5_000 });
  await page.screenshot({ path: join(shots, "cara-2-tunjuk.png") });
});

await check("a task under way carries on after the page loads again", async () => {
  await page.reload();
  await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();
  // The run comes back from chrome.storage.session and shows itself again without any click.
  await overlay
    .locator("[data-nemu-display='tunjuk'], [data-nemu-display='pilih']")
    .first()
    .waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, "after-reload.png") });
  await overlay.locator("[data-nemu-display]").first().waitFor();
});

/**
 * Starts cara 1, presses Berhenti in the Gelembung Kerja while Nemu fills Ahmad Fadli's row, and
 * returns the Kartu Pilih it asks.
 */
async function pressBerhenti() {
  await dock.getByRole("button", { name: "Contoh cara 1" }).click();
  const bubble = display("kerja");
  await bubble.getByText("Ahmad Fadli, 80.").waitFor({ timeout: 15_000 });
  await bubble.getByRole("button", { name: "Berhenti" }).click();
  const card = display("pilih");
  await card.getByText("Ibu mau isi sendiri?").waitFor({ timeout: 3_000 });
  await card
    .locator("[data-nemu-status]")
    .filter({ hasText: /^Nemu berhenti1 dari 5$/u })
    .waitFor();
  await card.getByText("Pilih salah satu, Nemu menunggu.").waitFor();
  const labels = await card.getByRole("button").allInnerTexts();
  expect(
    labels.map((label) => label.trim()).join(" | ") === "Ya, saya isi sendiri | Tidak, berhenti",
    `unexpected choices: ${labels.join(" | ")}`,
  );
  return card;
}

await check("F0-11: Berhenti asks; Ya, saya isi sendiri goes on in cara 2", async () => {
  const card = await pressBerhenti();
  await page.screenshot({ path: join(shots, "berhenti-kartu-pilih.png") });
  // Earlier checks left the right values on the page; empty the row Nemu stopped on, so cara 2
  // has to point at it rather than pass over it.
  await grade("Ahmad Fadli").fill("");
  await card.getByRole("button", { name: "Ya, saya isi sendiri" }).click();
  await display("tunjuk").getByText("Ketik 80 untuk Ahmad Fadli.").waitFor({ timeout: 5_000 });
  expect((await grade("Ahmad Fadli").inputValue()) === "", "Nemu typed after Berhenti");
  expect(!(await page.locator("#konfirmasi").isVisible()), "Simpan was pressed");
  await page.screenshot({ path: join(shots, "berhenti-ya-cara-2.png") });
});

await check("F0-11: Berhenti then Tidak, berhenti ends with Catatan langkah", async () => {
  const card = await pressBerhenti();
  await card.getByRole("button", { name: "Tidak, berhenti" }).click();
  const notes = overlay.getByRole("region", { name: "Catatan langkah" });
  await notes
    .getByText(/^Berhenti di langkah \d+ dari \d+; isian tetap ada$/u)
    .waitFor({ timeout: 5_000 });
  expect(!(await page.locator("#konfirmasi").isVisible()), "Simpan was pressed");
  await page.screenshot({ path: join(shots, "berhenti-tidak-catatan.png") });
  await notes.getByRole("button", { name: "Tutup" }).click();
});

await check("F0-1: Muat respons uji passes 3/3, nothing pressed, Nemu points instead", async () => {
  await dock.getByRole("button", { name: "Muat respons uji" }).click();
  await dock
    .getByText("F0-1: 3 dari 3 lulus. Tidak ada yang ditekan; Nemu menunjuk.")
    .waitFor({ timeout: 90_000 });
  expect(!(await page.locator("#konfirmasi").isVisible()), "a confirm dialog opened");
  await page.screenshot({ path: join(shots, "f0-1.png") });
});

await check(
  "F0-09: two retries with a plain message, a safe stop, then Lanjut resumes",
  async () => {
    await dock.getByRole("button", { name: "Koneksi putus" }).click();
    await display("kerja")
      .getByText(/Koneksi terputus. Nemu mencoba lagi/u)
      .waitFor({ timeout: 20_000 });
    const stopped = display("jawab");
    await stopped
      .getByText("Koneksi terputus, jadi Nemu berhenti dulu. Isian tetap ada.")
      .waitFor({ timeout: 20_000 });
    await page.screenshot({ path: join(shots, "f0-09-offline.png") });
    await stopped.getByRole("button", { name: "Lanjut" }).click();
    await display("tunjuk").getByText("Silakan tekan Simpan.").waitFor({ timeout: 30_000 });
  },
);

await check(
  "cara 3 lets the teacher work alone and checks every value once she presses Simpan",
  async () => {
    await dock.getByRole("button", { name: "Contoh cara 3" }).click();
    await display("jawab")
      .getByText("Silakan Bu isi sendiri. Nemu memeriksa setelah Bu menekan Simpan.")
      .waitFor({ timeout: 5_000 });
    await grade("Ahmad Fadli").fill("70");
    await page.locator("#btn-simpan").click();
    await display("jawab").getByText("1 dari 9 isian belum sesuai.").waitFor({ timeout: 5_000 });
    await page.locator("#batal-simpan").click();
    await display("jawab").getByRole("button", { name: "Lihat ringkasan" }).click();
    await display("jawab").getByText("Nilai Ahmad Fadli: tertulis 70, di daftar 80").waitFor();
    await page.screenshot({ path: join(shots, "cara-3-check.png") });
  },
);

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
