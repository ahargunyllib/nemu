// Loads a production build of the extension into Playwright's Chromium and checks #258 end to
// end: Sumber on an answer opens the cited PDF at its page in a new tab.
// - F3-2: "Nilai di bawah berapa harus remedial?" opens the seeded SOP Penilaian at page 2, and
//   "Nilai UTS paling lambat dimasukkan kapan?" at page 3 (F3-2_pertanyaan-dan-kunci.csv:
//   "sumber membuka halaman 2/3").
// - WS-1: Pak Rizal uploads the SOP Setoran Tahfidz in Pengetahuan sekolah; "Setoran minimal
//   berapa ayat?" opens it at page 1.
// The tab carries no Nemu headers, so it opens a short-lived signed link; the script checks the
// URL, `#page=`, and that the Nemu Service served `application/pdf` inline.
// Needs `NEMU_RESPONDER=fixture pnpm dev` running (it puts the seeded PDF in the local bucket).
// Screenshots: .output/verify-sumber/.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const ADMIN = process.env.NEMU_ADMIN_URL ?? "http://localhost:3002/";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");
const TAHFIDZ_TITLE = "SOP Setoran Tahfidz SDIT Nusantara";

const root = resolve(import.meta.dirname, "..");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-sumber");
const tahfidzPdf = resolve(
  root,
  "../../packages/api/src/testing/fixtures/WS-1_SOP-Setoran-Tahfidz-SDIT-Nusantara.pdf",
);
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
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;

// Every response for a document file, to read its status and headers.
const fileResponses = [];
context.on("response", (response) => {
  if (/\/api-reference\/documents\/[^/]+\/file/u.test(response.url())) fileResponses.push(response);
});

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

let tahfidzReady = false;
await check("WS-1: Pak Rizal uploads the SOP Setoran Tahfidz PDF, active", async () => {
  await signIn("rizal@nemu.demo", "rizal-demo-2026");
  await admin.goto(new URL("documents", ADMIN).href);
  // The seeded SOP is always listed, so a second row means the list has loaded.
  await admin.getByRole("row").nth(1).waitFor();
  await admin.waitForLoadState("networkidle");
  const rows = admin.getByRole("row").filter({ hasText: TAHFIDZ_TITLE });
  if (!(await rows.count())) {
    await admin.getByRole("button", { name: "Unggah dokumen" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("File").setInputFiles(tahfidzPdf);
    await dialog.getByLabel("Judul").fill(TAHFIDZ_TITLE);
    await dialog.getByLabel("Versi").fill("2026");
    const active = dialog.getByRole("switch", { name: "Langsung aktif" });
    if ((await active.getAttribute("aria-checked")) !== "true") await active.click();
    await dialog.getByRole("button", { name: "Unggah" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  }
  const activeRows = rows.filter({
    has: admin.getByRole("switch", { name: "Aktif", checked: true }),
  });
  if (!(await activeRows.count())) {
    await rows.first().getByRole("switch", { name: "Aktif" }).click();
    await activeRows.first().waitFor();
  }
  await admin.screenshot({ path: join(shots, "ws1-pengetahuan-sekolah.png") });
  tahfidzReady = true;
});
await admin.close();

const overlay = (page) => page.locator("nemu-overlay");
const bubble = (page) => overlay(page).getByRole("region", { name: "Jawaban Nemu" });

/** After a click on the Nemu button: Tanya Nemu when it shows its menu, so the type box opens. */
async function openTypeBox(overlay) {
  const typeBox = overlay.getByLabel("Pertanyaan untuk Nemu");
  const ask = overlay.getByRole("button", { name: /^Tanya Nemu \(/u });
  await typeBox.or(ask).first().waitFor({ timeout: 10_000 });
  if (await ask.count()) await ask.click();
}

async function ask(page, question) {
  const closed = overlay(page).locator("button[aria-label='Tanya Nemu']");
  const close = overlay(page).locator("button[aria-label='Tutup Nemu']");
  await closed.or(close).waitFor({ timeout: 10_000 });
  if (await closed.count()) await closed.click();
  // With kept Catatan langkah the Nemu button asks "Mau buka apa?" first (F1·12a).
  await openTypeBox(overlay(page));
  await overlay(page).getByLabel("Pertanyaan untuk Nemu").fill(question);
  await overlay(page).getByRole("button", { name: "Kirim" }).click();
}

/** Opens Sumber, clicks the cited source, and returns the new tab and the file's response. */
async function openSource(page, source, shot) {
  await bubble(page).getByRole("button", { name: "Sumber" }).click();
  const link = bubble(page).getByRole("button", { name: source });
  await link.waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, `${shot}-sumber.png`) });
  const before = fileResponses.length;
  const [tab] = await Promise.all([context.waitForEvent("page"), link.click()]);
  await tab.waitForLoadState();
  for (let waited = 0; fileResponses.length === before && waited < 10_000; waited += 100)
    await tab.waitForTimeout(100);
  const response = fileResponses.at(-1);
  expect(fileResponses.length > before && response, "the tab loaded no document file");
  // Give the PDF viewer a moment to draw the page before the screenshot.
  await tab.waitForTimeout(1500);
  await tab.screenshot({ path: join(shots, `${shot}-pdf.png`) });
  return { tab, response };
}

async function expectPdfAt(tab, response, page) {
  const url = new URL(tab.url());
  // The PDF viewer takes the navigation over, so Playwright sees no headers; the signed link is
  // still valid, so ask for it again and read what the Nemu Service serves.
  const served = await fetch(response.url());
  const headers = Object.fromEntries(served.headers);
  console.log(`  tab: ${url.origin}${url.pathname}${url.hash} (token hidden)`);
  console.log(`  ${served.status} ${headers["content-type"]} · ${headers["content-disposition"]}`);
  expect(url.origin === new URL(SERVER).origin, `opened ${url.origin}, not the Nemu Service`);
  expect(url.searchParams.has("token"), "the link carries no signed token");
  expect(url.hash === `#page=${page}`, `opened ${url.hash || "no page"}, expected #page=${page}`);
  expect(response.status() === 200, `the tab got HTTP ${response.status()}`);
  expect(served.status === 200, `the file answered HTTP ${served.status}`);
  expect(headers["content-type"] === "application/pdf", "not served as application/pdf");
  expect(/^inline;/u.test(headers["content-disposition"] ?? ""), "not served inline");
}

const page = await context.newPage();
await page.goto(new URL("#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

const cases = [
  {
    name: "F3-2 no. 1: Sumber opens the SOP Penilaian at page 2 (point 3.2)",
    question: "Nilai di bawah berapa harus remedial?",
    source: /SOP Penilaian SDIT Nusantara · hlm\. 2 · 3\.2/u,
    page: 2,
    shot: "f3-2-no1",
  },
  {
    name: "F3-2 no. 3: Sumber opens the SOP Penilaian at page 3 (point 4.1)",
    question: "Nilai UTS paling lambat dimasukkan kapan?",
    source: /SOP Penilaian SDIT Nusantara · hlm\. 3 · 4\.1/u,
    page: 3,
    shot: "f3-2-no3",
  },
  {
    name: "WS-1: Sumber opens the SOP Setoran Tahfidz at page 1",
    question: "Setoran minimal berapa ayat?",
    source: new RegExp(`${TAHFIDZ_TITLE} · hlm\\. 1`, "u"),
    page: 1,
    shot: "ws1",
    needs: () => tahfidzReady,
  },
];

for (const { name, question, source, page: pdfPage, shot, needs } of cases) {
  await check(name, async () => {
    expect(!needs || needs(), "its document isn't uploaded");
    await ask(page, question);
    await bubble(page).getByRole("button", { name: "Sumber" }).waitFor({ timeout: 20_000 });
    console.log(`  Q: ${question}`);
    console.log(`  A: ${(await bubble(page).innerText()).split("\n")[0]}`);
    const { tab, response } = await openSource(page, source, shot);
    await expectPdfAt(tab, response, pdfPage);
    await tab.close();
  });
}

await check("A changed token opens nothing", async () => {
  const last = fileResponses.at(-1);
  expect(last, "no link was opened");
  const url = new URL(last.url());
  url.searchParams.set("token", `${url.searchParams.get("token")}x`);
  const response = await fetch(url);
  console.log(`  ${response.status} for a changed token`);
  expect(response.status === 401, `expected 401, got ${response.status}`);
});

await context.close();
process.exit(failed ? 1 : 0);
