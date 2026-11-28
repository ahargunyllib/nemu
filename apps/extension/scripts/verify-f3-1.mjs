// F3-1 on the mock AlurSekolah (#213, #220): a process the school taught Nemu with no code change.
// Loads a production build of the extension into Playwright's Chromium, then:
//   1. Pak Rizal uploads the official tahfidz BPMN in Pengetahuan sekolah and, in WS-04, sets the
//      page of "Isi setoran satu kelas" to "Al-Quran › Setoran baru" (F3-19);
//   2. the setoran book photo lands in Bu Siti's inbox (as an upload, like a WhatsApp photo);
//   3. Bu Siti types "Catat setoran hafalan 4A hari ini" on the mock: the steps show first (2–6),
//      Mulai, Citra's scribbled Tajwid is asked (never guessed), the executor picks Kelas, opens
//      Setoran baru (the BPMN's "Setoran" choice) and fills it, and stops pointing at "Simpan setoran";
//   4. every row is checked against F3-1_kunci.csv (3/3) and nothing is saved until the "teacher"
//      presses Simpan setoran; then Catatan langkah names the system's tasks;
//   5. with no page in WS-04 Nemu only explains (cara 3).
// Needs `NEMU_RESPONDER=fixture pnpm dev` running. Screenshots: .output/verify-f3-1/.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const ADMIN = process.env.NEMU_ADMIN_URL ?? "http://localhost:3002/";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const HEADED = process.argv.includes("--headed");
// Bu Siti's AlurSekolah email in WS-06 (synthetic).
const EMAIL = "siti.aminah@sditnusantara.sch.id";
const TITLE = "Catat Hafalan Tahfidz";
const PAGE = "Al-Quran › Setoran baru";
// The BPMN task whose page WS-04 sets; "Pilih jenis catatan" names no button and leads into it.
const TASK = "Isi setoran satu kelas";

const root = resolve(import.meta.dirname, "..");
const fixtures = resolve(root, "../../packages/ai/src/school/fixtures");
const bpmn = join(fixtures, "F3-1_catat-hafalan-tahfidz.bpmn");
const photo = join(fixtures, "F3-1_foto-buku-setoran-tahfidz-4A.jpg");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f3-1");
mkdirSync(shots, { recursive: true });

// F3-1_kunci.csv: the truth of the book page (its last cell is quoted; only earlier ones are read).
const [header, ...lines] = readFileSync(join(fixtures, "F3-1_kunci.csv"), "utf8")
  .trim()
  .split("\n");
const keys = header.split(",");
const KUNCI = lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])));

// Bu Siti, as the extension calls the Nemu Service (ADR-0015).
const siti = createORPCClient(
  new RPCLink({
    url: `${SERVER}/rpc`,
    headers: { "x-nemu-install-code": INSTALL_CODE, "x-nemu-email": EMAIL },
  }),
);

execFileSync("pnpm", ["exec", "wxt", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WXT_SERVER_URL: SERVER, WXT_ADMIN_URL: ADMIN },
});

let failed = false;
let page;
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

const admin = await context.newPage();
async function signIn(email, password) {
  await context.clearCookies({ domain: new URL(ADMIN).hostname });
  await admin.goto(new URL("login", ADMIN).href);
  await admin.getByLabel("Email").fill(email);
  await admin.getByLabel("Password").fill(password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** WS-04: the page of the setoran task, as Pak Rizal types it in the sheet. */
async function setPage(value) {
  await admin.goto(new URL("documents", ADMIN).href);
  await admin.getByRole("row").nth(1).waitFor();
  await admin.waitForLoadState("networkidle");
  const rows = admin.getByRole("row").filter({
    has: admin.getByRole("button", { name: `Gejala dan halaman ${TITLE}` }),
  });
  await rows
    .filter({ has: admin.getByRole("switch", { name: "Aktif", checked: true }) })
    .first()
    .getByRole("button", { name: `Gejala dan halaman ${TITLE}` })
    .click();
  const sheet = admin.getByRole("dialog");
  const form = sheet.locator("form").filter({ hasText: TASK });
  await form.getByLabel("Halaman").fill(value);
  await form.getByRole("button", { name: "Simpan" }).click();
  await admin.getByText(`${TASK} disimpan`).first().waitFor({ timeout: 10_000 });
  await admin.keyboard.press("Escape");
}

let ready = false;
await check("WS-04: Pak Rizal uploads the tahfidz BPMN and sets its task's page", async () => {
  await signIn("rizal@nemu.demo", "rizal-demo-2026");
  await admin.goto(new URL("documents", ADMIN).href);
  await admin.getByRole("row").nth(1).waitFor();
  await admin.waitForLoadState("networkidle");
  const button = admin.getByRole("button", { name: `Gejala dan halaman ${TITLE}` });
  if (!(await button.count())) {
    await admin.getByRole("button", { name: "Unggah dokumen" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("File").setInputFiles(bpmn);
    await dialog.getByLabel("Judul").fill(TITLE);
    await dialog.getByLabel("Versi").fill("1");
    const active = dialog.getByRole("switch", { name: "Langsung aktif" });
    if ((await active.getAttribute("aria-checked")) !== "true") await active.click();
    await dialog.getByRole("button", { name: "Unggah" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  }
  const rows = admin.getByRole("row").filter({ has: button });
  const activeRows = rows.filter({
    has: admin.getByRole("switch", { name: "Aktif", checked: true }),
  });
  if (!(await activeRows.count())) {
    await rows.first().getByRole("switch", { name: "Aktif" }).click();
    await activeRows.first().waitFor();
  }
  await setPage(PAGE);
  await admin.screenshot({ path: join(shots, "ws04-halaman.png") });
  ready = true;
});

// Start clean: no photo left in Bu Siti's inbox, no setoran in the mock.
for (const job of await siti.inboxJobs()) await siti.inboxAck({ jobId: job.jobId });
await fetch(new URL("_mock/reset", MOCK), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

let jobId = null;
await check("the setoran book photo lands in Bu Siti's inbox", async () => {
  const job = await siti.inboxUploadPhoto({
    file: new File([readFileSync(photo)], "buku-setoran-4A.jpg", { type: "image/jpeg" }),
  });
  expect(job.status === "queued", `the photo is ${job.status}`);
  jobId = job.jobId;
});

page = await context.newPage();
await page.goto(new URL("#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

const overlay = page.locator("nemu-overlay");
const display = (type) => overlay.locator(`[data-nemu-display='${type}']`);
async function ask(question) {
  const closed = overlay.locator("button[aria-label='Tanya Nemu']");
  const close = overlay.locator("button[aria-label='Tutup Nemu']");
  await closed.or(close).waitFor({ timeout: 10_000 });
  if (await closed.count()) await closed.click();
  await overlay.getByLabel("Pertanyaan untuk Nemu").fill(question);
  await overlay.getByRole("button", { name: "Kirim" }).click();
}

await check(
  "F3-15: the steps show first, in 2–6 plain steps, before Nemu does anything",
  async () => {
    expect(ready, "the BPMN isn't uploaded");
    await ask("Catat setoran hafalan 4A hari ini");
    const steps = overlay.getByRole("region", { name: `Langkah ${TITLE}` });
    await steps.waitFor({ timeout: 15_000 });
    const items = await steps.locator("li").allInnerTexts();
    console.log(`  ${items.join(" | ")}`);
    expect(items.length >= 2 && items.length <= 6, `${items.length} steps`);
    expect(items[0] === `Buka ${PAGE}.`, `first step: ${items[0]}`);
    expect(
      items.some((item) => /Simpan setoran; Nemu berhenti sebelum itu/u.test(item)),
      "the steps don't say the teacher presses Simpan setoran",
    );
    expect(
      items.some((item) => /^Pilih jenis catatan: kelas 4A, Setoran\.$/u.test(item)),
      "the steps don't say Kelas 4A and Setoran are picked",
    );
    expect(
      items.some((item) => /Sistem AlurSekolah: hitung nilai dan huruf/u.test(item)),
      "the system's task isn't announced (F3-18)",
    );
    expect((await page.locator("#tf-kelas").count()) === 0, "Nemu moved before Mulai");
    await page.screenshot({ path: join(shots, "langkah.png") });
    await steps.getByRole("button", { name: "Mulai" }).click();
  },
);

await check(
  "F3-16: Citra's scribbled Tajwid is asked with the photo crop, never guessed",
  async () => {
    const card = display("pilih");
    await card.getByText("Skor Tajwid Citra?", { exact: true }).waitFor({ timeout: 30_000 });
    const labels = await card.getByRole("group").getByRole("button").allTextContents();
    expect(labels.includes("Ucapkan atau ketik angkanya"), `choices: ${labels.join(", ")}`);
    expect(labels.includes("Kosongkan dulu"), `choices: ${labels.join(", ")}`);
    expect((await card.getByRole("img").count()) === 1, "no crop of the cell");
    expect(
      (await card.getByText("Potongan foto · Citra, Tajwid", { exact: true }).count()) === 1,
      "the crop has no caption",
    );
    await page.screenshot({ path: join(shots, "tanya-tajwid.png") });
    // The test teacher's answer (F3-1_kunci.csv): a choice when offered, else typed.
    const truth = KUNCI.find((row) => row.murid === "Citra Lestari").tajwid;
    if (labels.includes(truth)) {
      await card.getByRole("group").getByRole("button", { name: truth, exact: true }).click();
    } else {
      await card
        .getByRole("group")
        .getByRole("button", { name: "Ucapkan atau ketik angkanya" })
        .click();
      await overlay.getByLabel("Pertanyaan untuk Nemu").fill(truth);
      await overlay.getByRole("button", { name: "Kirim" }).click();
    }
  },
);

await check(
  "F3-17/19: Nemu opens Al-Quran › Setoran baru through the menu and fills it",
  async () => {
    await page.waitForURL(/#\/tahfidz$/u, { timeout: 20_000 });
    await page.locator("#tabel-setoran").waitFor({ timeout: 20_000 });
    await display("tunjuk").getByText("Silakan Ibu tekan Simpan setoran.").waitFor({
      timeout: 120_000,
    });
    await page.screenshot({ path: join(shots, "tunjuk-simpan-setoran.png") });
  },
);

await check(
  "F3-1: 3/3 rows match F3-1_kunci.csv, and Nemu stops before Simpan setoran",
  async () => {
    expect((await page.locator("#tf-kelas").inputValue()) === "4A", "Kelas isn't 4A");
    const date = await page.locator("#tanggal_setoran").inputValue();
    expect(date === "2026-12-01", `Tanggal setoran is ${date}`);
    let matched = 0;
    for (const want of KUNCI) {
      const row = page.locator(`#tabel-setoran tr[data-murid="${want.murid}"]`);
      const got = {
        surah: await row.locator(".tf-surah").inputValue(),
        ayat_dari: await row.locator(".tf-ayat_dari").inputValue(),
        ayat_sampai: await row.locator(".tf-ayat_sampai").inputValue(),
        fashohah: await row.locator(".tf-fashohah").inputValue(),
        tartil: await row.locator(".tf-tartil").inputValue(),
        tajwid: await row.locator(".tf-tajwid").inputValue(),
        adab: await row.locator(".tf-adab").inputValue(),
      };
      const wrong = Object.entries(got).filter(([key, value]) => value !== want[key]);
      if (!wrong.length) matched += 1;
      else
        console.log(
          `  ${want.murid}: ${wrong.map(([k, v]) => `${k}=${v} (kunci ${want[k]})`).join(", ")}`,
        );
    }
    console.log(`  ${matched}/${KUNCI.length} rows match the kunci`);
    expect(matched === KUNCI.length, `${matched}/${KUNCI.length} rows match`);
    const others = await page.locator("#tabel-setoran tbody tr").evaluateAll(
      (rows, names) =>
        rows.filter(
          (row) => !names.includes(row.dataset.murid) && row.querySelector(".tf-surah").value,
        ).length,
      KUNCI.map((row) => row.murid),
    );
    expect(others === 0, `${others} other students were filled`);
    expect(!(await page.locator("#konfirmasi").isVisible()), "Simpan setoran was pressed by Nemu");
    const saved = await (await fetch(new URL("_mock/tahfidz", MOCK))).json();
    expect(saved.length === 0, `${saved.length} setoran saved before the teacher pressed Simpan`);
  },
);

await check("the teacher saves; Catatan langkah names the system's tasks", async () => {
  await page.locator("#btn-simpan-setoran").click();
  await page.locator("#ya-simpan").click();
  await page.getByText("Setoran tersimpan untuk 3 murid kelas 4A.").waitFor();
  const notes = overlay.getByRole("region", { name: "Catatan langkah" });
  await notes.waitFor({ timeout: 10_000 });
  const items = await notes.locator("li").allInnerTexts();
  console.log(`  ${items.join(" | ")}`);
  expect(
    items.some((item) => /Ibu menekan Simpan setoran|Bu menekan Simpan setoran/u.test(item)),
    "no 'menekan Simpan setoran'",
  );
  expect(
    items.some((item) => /Sistem AlurSekolah: hitung nilai dan huruf/u.test(item)),
    "the system's score task isn't named",
  );
  expect(
    items.some((item) => /Sistem AlurSekolah: tampilkan di aplikasi orang tua/u.test(item)),
    "the system's parent-app task isn't named",
  );
  expect(items.includes("Foto dihapus dari Nemu"), "the photo wasn't deleted");
  const left = await siti.inboxJobs();
  expect(!left.some((job) => job.jobId === jobId), "the photo is still in the inbox");
  await page.screenshot({ path: join(shots, "catatan-langkah.png") });
  await notes.getByRole("button", { name: "Tutup" }).click();
});

await check("F3-19: with no page in WS-04, Nemu only explains (cara 3)", async () => {
  await setPage("");
  await page.locator("#menu-beranda").click();
  await ask("Catat setoran hafalan 4A hari ini");
  const steps = overlay.getByRole("region", { name: `Langkah ${TITLE}` });
  await steps.waitFor({ timeout: 15_000 });
  await steps.getByText("jadi Nemu hanya menjelaskan", { exact: false }).waitFor();
  expect((await steps.getByRole("button", { name: "Mulai" }).count()) === 0, "Mulai is offered");
  await page.screenshot({ path: join(shots, "hanya-menjelaskan.png") });
  await steps.getByRole("button", { name: "Tutup" }).click();
  await setPage(PAGE);
});

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
