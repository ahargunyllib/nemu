// Loads a production build of the extension into Playwright's Chromium and checks F2-08 (#206)
// end to end: Admin Javan connects WS-07 to the mock AlurSekolah, Pak Rizal uploads the official
// SPP BPMN (F2-1) in Pengetahuan sekolah and sees the suggested symptoms, Bu Siti's UTS grade for
// Aisyah (4A) is saved in the mock, and then the three questions of F2-1_pertanyaan-dan-kunci.csv
// are asked on the mock: the answer, Kenapa?, Sumber with 2–4 steps and Lihat diagram (bpmn-js,
// cause highlighted), and the parent reply in WhatsApp Web (answered locally, never sent; no
// amounts, no "tunggakan").
// Also: grades the mock doesn't have, and a question no process covers (F3-14).
// Needs `NEMU_RESPONDER=fixture pnpm dev` running. Screenshots: .output/verify-f2-08/.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const ADMIN = process.env.NEMU_ADMIN_URL ?? "http://localhost:3002/";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const MOCK_KEY = process.env.MOCK_ALURSEKOLAH_API_KEY ?? "as_uji_sdit_nusantara_2026";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f2-08");
const bpmn = resolve(root, "../../packages/ai/src/school/fixtures/F2-1_alur-spp.bpmn");
mkdirSync(shots, { recursive: true });

execFileSync("pnpm", ["exec", "wxt", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WXT_SERVER_URL: SERVER, WXT_ADMIN_URL: ADMIN },
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

const admin = await context.newPage();
async function signIn(email, password) {
  await context.clearCookies({ domain: new URL(ADMIN).hostname });
  await admin.goto(new URL("login", ADMIN).href);
  await admin.getByLabel("Email").fill(email);
  await admin.getByLabel("Password").fill(password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL((url) => !url.pathname.startsWith("/login"));
}

await check("WS-07: Admin Javan connects AlurSekolah to the mock", async () => {
  await signIn("javan@nemu.demo", "javan-demo-2026");
  await admin.goto(new URL("integrations", ADMIN).href);
  for (const [label, value] of [
    ["URL API", MOCK.replace(/\/$/u, "")],
    ["Kunci API", MOCK_KEY],
  ]) {
    await admin.getByRole("button", { name: `Ganti ${label}` }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel(label).fill(value);
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await dialog.waitFor({ state: "hidden" });
  }
});

let documentReady = false;
await check(
  "WS-04: Pak Rizal uploads the SPP BPMN; the symptoms are suggested on upload",
  async () => {
    await signIn("rizal@nemu.demo", "rizal-demo-2026");
    await admin.goto(new URL("documents", ADMIN).href);
    const symptoms = admin.getByRole("button", { name: "Gejala dan halaman Alur SPP" });
    // The seeded SOP is always listed, so a second row means the list has loaded.
    await admin.getByRole("row").nth(1).waitFor();
    await admin.waitForLoadState("networkidle");
    if (!(await symptoms.count())) {
      await admin.getByRole("button", { name: "Unggah dokumen" }).click();
      const dialog = admin.getByRole("dialog");
      await dialog.getByLabel("File").setInputFiles(bpmn);
      await dialog.getByLabel("Judul").fill("Alur SPP");
      await dialog.getByLabel("Versi").fill("1");
      const active = dialog.getByRole("switch", { name: "Langsung aktif" });
      if ((await active.getAttribute("aria-checked")) !== "true") await active.click();
      await dialog.getByRole("button", { name: "Unggah" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 20_000 });
    }
    // A copy left inactive by an earlier run is switched on in its row.
    const rows = admin.getByRole("row").filter({ has: symptoms });
    const activeRows = rows.filter({
      has: admin.getByRole("switch", { name: "Aktif", checked: true }),
    });
    if (!(await activeRows.count())) {
      await rows.first().getByRole("switch", { name: "Aktif" }).click();
      await activeRows.first().waitFor();
    }
    await activeRows.first().getByRole("button", { name: "Gejala dan halaman Alur SPP" }).click();
    const sheet = admin.getByRole("dialog");
    await sheet
      .getByText("nilai tidak muncul di aplikasi orang tua", { exact: false })
      .first()
      .waitFor({ timeout: 10_000 });
    await admin.screenshot({ path: join(shots, "ws04-symptoms.png") });
    await admin.keyboard.press("Escape");
    documentReady = true;
  },
);

// Bu Siti saved UTS Bahasa Inggris 4A for Aisyah; Kevin (4B) has no grade.
await fetch(new URL("_mock/reset", MOCK), { method: "POST" });
const saved = await fetch(new URL("_mock/nilai", MOCK), {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    username: "siti.aminah",
    kelas: "4A",
    mapel: "Bahasa Inggris",
    jenis: "UTS",
    baris: [{ nama: "Aisyah Putri Wijaya", nilai: "86", catatan: "" }],
  }),
});
expect(saved.ok, `saving the mock grades failed: HTTP ${saved.status}`);

const overlay = (page) => page.locator("nemu-overlay");
const bubble = (page) => overlay(page).getByRole("region", { name: "Jawaban Nemu" });
async function ask(page, question) {
  const closed = overlay(page).locator("button[aria-label='Tanya Nemu']");
  const close = overlay(page).locator("button[aria-label='Tutup Nemu']");
  await closed.or(close).waitFor({ timeout: 10_000 });
  if (await closed.count()) await closed.click();
  await overlay(page).getByLabel("Pertanyaan untuk Nemu").fill(question);
  await overlay(page).getByRole("button", { name: "Kirim" }).click();
}
async function parentReply(page) {
  const [whatsapp] = await Promise.all([
    context.waitForEvent("page"),
    bubble(page).getByRole("button", { name: "Buka balasan untuk orang tua" }).click(),
  ]);
  await whatsapp.waitForLoadState();
  const url = new URL(whatsapp.url());
  await whatsapp.close();
  return url;
}
function expectSafeReply(url) {
  const text = url.searchParams.get("text") ?? "";
  console.log(`  ${url.origin}${url.pathname} phone=${url.searchParams.get("phone")}`);
  console.log(`  text: ${text}`);
  expect(`${url.origin}${url.pathname}` === "https://web.whatsapp.com/send", "not WhatsApp Web");
  expect(!url.searchParams.has("phone"), "the reply names a number; the teacher picks the chat");
  expect(!/tunggakan/iu.test(text), "the reply says tunggakan");
  expect(!/rp\s?\d|\d[\d.]*\s?(ribu|juta)/iu.test(text), "the reply names an amount");
  return text;
}

const page = await context.newPage();
await page.goto(new URL("#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

await check(
  "F2-1 Q1: Aisyah's grade is saved, the cause is only 'kemungkinan'; Bu Ratna helps",
  async () => {
    expect(documentReady, "the SPP BPMN isn't uploaded");
    await ask(page, "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?");
    await bubble(page)
      .getByText("Nilai Aisyah Putri Wijaya sudah tersimpan.", { exact: false })
      .waitFor({ timeout: 15_000 });
    await bubble(page)
      .getByText("Kemungkinan karena alur SPP sekolah:", { exact: false })
      .waitFor();
    await page.screenshot({ path: join(shots, "q1-sentence.png") });
    await bubble(page)
      .getByText("Yang bisa membantu: Bu Ratna (keuangan).", { exact: false })
      .waitFor();
    await bubble(page).getByRole("button", { name: "Kenapa?" }).click();
    await bubble(page).getByText("Jalan kembalinya:", { exact: false }).waitFor();
    await bubble(page).getByRole("button", { name: "Sumber" }).click();
    await bubble(page).getByText("Kenapa nilai bisa belum tampil?").waitFor();
    await bubble(page)
      .getByText("Nemu tidak bisa melihat status tagihan. Pastikan ke bagian keuangan.")
      .waitFor();
    const steps = bubble(page).locator("li");
    const count = await steps.count();
    console.log(`  Sumber: ${(await steps.allInnerTexts()).join(" | ")}`);
    expect(count >= 2 && count <= 4, `Sumber has ${count} steps`);
    await page.screenshot({ path: join(shots, "q1-answer.png") });
  },
);

await check(
  "Lihat diagram: bpmn-js draws the SPP process with Lock Student Grades highlighted",
  async () => {
    const link = bubble(page).getByRole("link", { name: "Lihat diagram Alur SPP" });
    const [diagram] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await diagram.waitForLoadState();
    console.log(`  ${diagram.url()}`);
    const cause = diagram.locator(".djs-element.nemu-cause[data-element-id='Task_LockGrades']");
    await cause.waitFor({ timeout: 15_000 });
    const path = await diagram.locator(".djs-element.nemu-path").count();
    expect(path >= 3, `only ${path} path elements are marked`);
    const stroke = await cause
      .locator(".djs-visual > :first-child")
      .evaluate((shape) => getComputedStyle(shape).strokeWidth);
    expect(stroke === "4px", `the cause isn't outlined (stroke ${stroke})`);
    await diagram.screenshot({ path: join(shots, "lihat-diagram.png") });
    await diagram.close();
  },
);

await check(
  "F2-1 Q1: the parent reply opens in WhatsApp Web; the teacher presses Kirim",
  async () => {
    const text = expectSafeReply(await parentReply(page));
    expect(text.startsWith("Assalamu"), "the greeting is missing");
    expect(text.includes("sudah kami masukkan"), "the reply doesn't say the grade is in");
    expect(text.includes("Bu Ratna"), "the reply doesn't name Bu Ratna");
  },
);

await check("F2-1 Q2: paid in part, still locked: the Overdue Left branch, Bu Ratna", async () => {
  await ask(page, "Orang tuanya bilang sudah bayar sebagian, kok masih terkunci?");
  await bubble(page)
    .getByText("sebagian dibayar", { exact: false })
    .first()
    .waitFor({ timeout: 15_000 });
  await bubble(page).getByText("Bu Ratna (keuangan)", { exact: false }).waitFor();
  const text = expectSafeReply(await parentReply(page));
  expect(text.includes("Bu Ratna"), "the reply doesn't name Bu Ratna");
});

await check("F2-1 Q3: paid in cash: from Paid in Cash to Unlock, Bu Ratna", async () => {
  await ask(page, "Kalau bayar tunai, kapan nilainya terbuka?");
  await bubble(page)
    .getByText("pembayaran tunai", { exact: false })
    .first()
    .waitFor({ timeout: 15_000 });
  await bubble(page).getByText("Bu Ratna (keuangan)", { exact: false }).waitFor();
  const text = expectSafeReply(await parentReply(page));
  expect(text.includes("Bu Ratna"), "the reply doesn't name Bu Ratna");
  await page.screenshot({ path: join(shots, "q3-tunai.png") });
});

await check("F3-13: Kevin has no grade in AlurSekolah, so Nemu says to save it first", async () => {
  await ask(page, "Kenapa nilai Kevin tidak muncul di aplikasi orang tua?");
  await bubble(page)
    .getByText("Nilai Kevin Ardiansyah belum tersimpan di AlurSekolah", { exact: false })
    .waitFor({ timeout: 15_000 });
});

await check("F3-14: something no process covers is 'Belum ada di proses sekolah.'", async () => {
  await ask(page, "Kenapa jadwal pelajaran besok berubah?");
  await bubble(page)
    .getByText("Belum ada di proses sekolah.", { exact: false })
    .waitFor({ timeout: 15_000 });
});

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
