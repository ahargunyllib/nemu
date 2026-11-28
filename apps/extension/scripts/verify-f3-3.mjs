// F3-3 on the mock AlurSekolah (#214): "Rekam cara", review, BPMN export and 5 replays.
// Loads a production build of the extension into Playwright's Chromium (with a fake microphone):
//   1. Bu Siti types "Rekam cara Catat ujian tahfidz" and does the Ujian baru form once on the
//      mock, holding Ctrl + Space once to explain a step (narration on the recording's clock),
//      and types one date during Jeda, which isn't recorded;
//   2. Selesai hands it over; "Periksa rekaman" opens the Admin Workspace, where Pak Rizal (signed
//      in) sees the steps with Simpan ujian "dikerjakan guru", renames an input, tries deleting a
//      step, and saves it; the steps match F3-3_langkah-yang-diharapkan.json;
//   3. "Unduh BPMN" gives a BPMN 2.0 file that bpmn-js (bpmn.io) draws without warnings;
//   4. each row of F3-3_putaran-ulang.csv is replayed: Nemu asks for each value, fills the form
//      through the executor and stops pointing at Simpan ujian, with "Rekaman Bu Siti, langkah 11
//      dari 11" behind Sumber; the "teacher" saves and the mock has the row (5/5).
// (`rizal.operator` is the mock's unregistered account for ID-02, so the recording is Bu Siti's.)
// Needs `NEMU_RESPONDER=fixture pnpm dev` running. Screenshots: .output/verify-f3-3/.
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
const EMAIL = "siti.aminah@sditnusantara.sch.id";
const TITLE = "Catat ujian tahfidz";

const root = resolve(import.meta.dirname, "..");
const fixtures = resolve(root, "../../packages/ai/src/school/fixtures");
const viewerScript = resolve(
  root,
  "../admin/node_modules/bpmn-js/dist/bpmn-viewer.production.min.js",
);
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f3-3");
mkdirSync(shots, { recursive: true });

const EXPECTED = JSON.parse(
  readFileSync(join(fixtures, "F3-3_langkah-yang-diharapkan.json"), "utf8"),
);
const [header, ...lines] = readFileSync(join(fixtures, "F3-3_putaran-ulang.csv"), "utf8")
  .trim()
  .split("\n");
const keys = header.split(",");
const REPLAYS = lines.map((line) =>
  Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])),
);

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
  acceptDownloads: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
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

// Pak Rizal is signed in to the Admin Workspace, where recordings are reviewed.
const admin = await context.newPage();
await admin.goto(new URL("login", ADMIN).href);
await admin.getByLabel("Email").fill("rizal@nemu.demo");
await admin.getByLabel("Password").fill("rizal-demo-2026");
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.waitForURL((url) => !url.pathname.startsWith("/login"));

// A procedure with this title from an earlier run is switched off, so this run's is the one.
await admin.goto(new URL("documents", ADMIN).href);
await admin.getByRole("row").nth(1).waitFor();
await admin.waitForLoadState("networkidle");
const old = admin
  .getByRole("row")
  .filter({ hasText: TITLE })
  .filter({ has: admin.getByRole("switch", { name: "Aktif", checked: true }) });
while (await old.count()) {
  await old.first().getByRole("switch", { name: "Aktif" }).click();
  await admin.waitForTimeout(800);
}

await fetch(new URL("_mock/reset", MOCK), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

const page = await context.newPage();
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

let review = null;
await check("Rekam cara records the Ujian baru form and one spoken explanation", async () => {
  await ask(`Rekam cara ${TITLE}`);
  const bubble = overlay.getByRole("region", { name: "Nemu merekam" });
  const pill = overlay.locator("[data-nemu-recording]");
  await bubble.waitFor({ timeout: 10_000 });
  await page.locator("#menu-alquran").click();
  await page.locator("#tf-kelas").selectOption("4A");
  await page.locator("#btn-ujian-baru").click();
  await page.locator("#uj-murid").selectOption("Aisyah Putri Wijaya");
  // Pak Rizal explains while holding the talk combination; it is narration, not a question.
  await page.keyboard.down("Control");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1200);
  await page.keyboard.up("Space");
  await page.keyboard.up("Control");
  await overlay.getByRole("region", { name: "Yang Nemu dengar" }).waitFor({ timeout: 15_000 });
  await page.locator("#uj-jenis").selectOption("Ujian Juz 30");
  // Jeda: a date typed while paused isn't recorded; Lanjut records again from the same step.
  const counted = await pill.innerText();
  await bubble.getByRole("button", { name: "Jeda" }).click();
  await bubble.getByText("Rekaman dijeda.").waitFor();
  await overlay.locator("[data-nemu-recording='paused']").waitFor();
  await page.locator("#uj-tanggal").fill("2026-11-30");
  const paused = await pill.innerText();
  expect(
    paused === counted.replace("Merekam cara", "Dijeda"),
    `paused pill "${paused}" after "${counted}"`,
  );
  await page.screenshot({ path: join(shots, "dijeda.png") });
  await bubble.getByRole("button", { name: "Lanjut" }).click();
  await page.locator("#uj-tanggal").fill("2026-12-01");
  for (const [id, value] of [
    ["uj-fashohah", "90"],
    ["uj-tartil", "88"],
    ["uj-tajwid", "85"],
    ["uj-adab", "95"],
  ])
    await page.locator(`#${id}`).fill(value);
  await page.locator("#btn-simpan-ujian").click();
  await page.getByText("Ujian Aisyah Putri Wijaya tersimpan.", { exact: false }).waitFor();
  await pill.getByText("Merekam cara · langkah 11").waitFor({ timeout: 5000 });
  await page.screenshot({ path: join(shots, "merekam.png") });
  await bubble.getByRole("button", { name: "Selesai" }).click();
  const saved = display("jawab").filter({ hasText: "Rekaman tersimpan: 11 langkah." });
  await saved.waitFor({ timeout: 10_000 });
  [review] = await Promise.all([
    context.waitForEvent("page"),
    saved.getByRole("button", { name: "Periksa rekaman" }).click(),
  ]);
  await review.waitForLoadState();
});

let documentId = null;
await check(
  "F3-02: the review shows 11 steps, Simpan ujian dikerjakan guru; rename, delete, save",
  async () => {
    expect(review, "the review page didn't open");
    console.log(`  ${review.url()}`);
    const rows = review.getByRole("row");
    await review.getByText("Rekaman Bu Siti").waitFor({ timeout: 20_000 });
    await rows.nth(11).waitFor();
    expect((await rows.count()) === 12, `${(await rows.count()) - 1} steps in the review`);
    const last = rows.nth(11);
    await last.getByText("dikerjakan guru").waitFor();
    expect(await last.getByText("Simpan ujian").count(), "step 11 isn't Simpan ujian");
    await review.getByText("penjelasan suara", { exact: false }).first().waitFor();
    const heard = await review.getByText(/dtk: “/u).count();
    expect(heard === 1, `${heard} narration lines`);
    // Deleting a step renumbers the rest (tried, then undone by recompiling the recording).
    await review.getByRole("button", { name: "Hapus langkah 3" }).click();
    expect((await rows.count()) === 11, "the step wasn't deleted");
    await review.reload();
    await rows.nth(11).waitFor({ timeout: 20_000 });
    await review.getByLabel("Nama isian (Aisyah Putri Wijaya)").fill("Nama murid");
    await review.getByText("‹Nama murid›").waitFor();
    await review.screenshot({ path: join(shots, "periksa-rekaman.png"), fullPage: true });
    await review.getByRole("button", { name: "Simpan cara" }).click();
    await review.getByText(`${TITLE} disimpan`).waitFor({ timeout: 15_000 });
    const listed = (await siti.procedureList()).filter((item) => item.title === TITLE);
    expect(listed.length === 1, `${listed.length} active procedures called ${TITLE}`);
    documentId = listed[0].documentId;
  },
);

await check("F3-3: the saved steps match F3-3_langkah-yang-diharapkan.json", async () => {
  const procedure = await siti.procedureGet({ documentId });
  const steps = procedure.steps.map((step) => ({
    order: step.order,
    action: step.action,
    target: step.locator.label ?? step.locator.name,
    valueTemplate: step.valueTemplate,
    requiresHumanAction: step.requiresHumanAction,
  }));
  const wrong = steps.filter((step, i) => JSON.stringify(step) !== JSON.stringify(EXPECTED[i]));
  for (const step of wrong) console.log(`  got ${JSON.stringify(step)}`);
  expect(steps.length === EXPECTED.length && !wrong.length, `${wrong.length} steps differ`);
  expect(procedure.recordedBy === "Bu Siti", `recorded by ${procedure.recordedBy}`);
  expect(
    procedure.parameters.find((parameter) => parameter.name === "murid")?.label === "Nama murid",
    "the rename wasn't saved",
  );
});

await check("F3-03: Unduh BPMN gives a file bpmn-js (bpmn.io) draws with no warnings", async () => {
  const [download] = await Promise.all([
    review.waitForEvent("download"),
    review.getByRole("button", { name: `Unduh BPMN ${TITLE}` }).click(),
  ]);
  expect(download.suggestedFilename() === "Catat-ujian-tahfidz.bpmn", download.suggestedFilename());
  const xml = readFileSync(await download.path(), "utf8");
  const viewer = await context.newPage();
  await viewer.setContent('<div id="canvas" style="width:1400px;height:500px"></div>');
  await viewer.addScriptTag({ path: viewerScript });
  const result = await viewer.evaluate(async (source) => {
    const bpmn = new window.BpmnJS({ container: "#canvas" });
    const { warnings } = await bpmn.importXML(source);
    const registry = bpmn.get("elementRegistry");
    return {
      warnings: warnings.map((warning) => warning.message),
      tasks: registry
        .filter((element) => element.type === "bpmn:UserTask")
        .map((e) => e.businessObject.name),
    };
  }, xml);
  console.log(`  ${result.tasks.length} user tasks; last: ${result.tasks.at(-1)}`);
  expect(!result.warnings.length, result.warnings.join("; "));
  expect(result.tasks.length === 11, `${result.tasks.length} user tasks`);
  expect(result.tasks.at(-1) === "Guru menekan Simpan ujian", result.tasks.at(-1));
  expect(
    xml.includes('<camunda:formField id="murid" label="Nama murid"'),
    "no Nama murid form field",
  );
  await viewer.screenshot({ path: join(shots, "bpmn-io.png") });
  await viewer.close();
});

let passed = 0;
for (const row of REPLAYS) {
  await check(`F3-3 replay ${row.putaran}: ${row.murid}, stops before Simpan ujian`, async () => {
    await page.bringToFront();
    await page.locator("#menu-beranda").click();
    await ask(`${TITLE} untuk ${row.murid}`);
    const order = [
      "kelas",
      "murid",
      "jenis_ujian",
      "tanggal_ujian",
      "fashohah",
      "tartil",
      "tajwid",
      "adab",
    ];
    const questions = [];
    for (const name of order) {
      // One question at a time: wait for the next one before answering.
      let asked = "";
      for (let tries = 0; tries < 100; tries += 1) {
        const texts = await display("jawab").allInnerTexts();
        asked = texts.map((text) => text.trim()).find((text) => text.endsWith("?")) ?? "";
        if (asked && asked !== questions.at(-1)) break;
        await page.waitForTimeout(100);
      }
      expect(asked && asked !== questions.at(-1), `no question for ${name}`);
      questions.push(asked);
      const box = overlay.getByLabel("Pertanyaan untuk Nemu");
      await box.fill(row[name]);
      await box.press("Enter");
    }
    if (row.putaran === "1") console.log(`  asked: ${questions.join(" | ")}`);
    const point = display("tunjuk").filter({ hasText: "Silakan Ibu tekan Simpan ujian." });
    await point.waitFor({ timeout: 60_000 });
    await point.getByRole("button", { name: "Sumber" }).click();
    await point.getByText("Rekaman Bu Siti, langkah 11 dari 11").waitFor();
    const form = {
      kelas: await page.locator("#tf-kelas").inputValue(),
      murid: await page.locator("#uj-murid").inputValue(),
      jenis_ujian: await page.locator("#uj-jenis").inputValue(),
      tanggal_ujian: await page.locator("#uj-tanggal").inputValue(),
      fashohah: await page.locator("#uj-fashohah").inputValue(),
      tartil: await page.locator("#uj-tartil").inputValue(),
      tajwid: await page.locator("#uj-tajwid").inputValue(),
      adab: await page.locator("#uj-adab").inputValue(),
    };
    const wrong = Object.entries(form).filter(([key, value]) => value !== row[key]);
    expect(!wrong.length, wrong.map(([k, v]) => `${k}=${v} (want ${row[k]})`).join(", "));
    const before = await (await fetch(new URL("_mock/tahfidz", MOCK))).json();
    expect(
      !before.some((x) => x.murid === row.murid),
      "saved before the teacher pressed Simpan ujian",
    );
    if (row.putaran === "1") await page.screenshot({ path: join(shots, "putar-ulang-tunjuk.png") });
    await page.locator("#btn-simpan-ujian").click();
    await page.getByText(`Ujian ${row.murid} tersimpan.`, { exact: false }).waitFor();
    const notes = overlay.getByRole("region", { name: "Catatan langkah" });
    await notes.waitFor({ timeout: 10_000 });
    await notes.getByText("Sumber: Rekaman Bu Siti").waitFor();
    await notes.getByRole("button", { name: "Tutup" }).click();
    const after = await (await fetch(new URL("_mock/tahfidz", MOCK))).json();
    const saved = after.find((x) => x.murid === row.murid);
    expect(
      saved && saved.jenis_ujian === row.jenis_ujian && String(saved.tajwid) === row.tajwid,
      `the mock has ${JSON.stringify(saved)}`,
    );
    passed += 1;
  });
}
console.log(`  ${passed}/${REPLAYS.length} replays`);
if (passed !== REPLAYS.length) failed = true;

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
