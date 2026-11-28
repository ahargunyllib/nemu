// F1-2 on the mock AlurSekolah (#208): F1 in cara 2. Loads a development build of the extension
// into Playwright's Chromium and runs the F1 flow twice as Bu Siti, from the WhatsApp photo to the
// read-back. Each time Nemu starts filling in cara 1 and the rest switches to cara 2: once because
// the teacher takes over (her click on the page, then "Ya, saya isi sendiri"), once by "Ajari saya"
// (the dev dock's button does what the spoken command does; the test microphone can't say it).
// In cara 2 the "teacher" types what Nemu says, except where F1-2_cara-2_skenario.csv has her type
// something else first. Both deliberate mismatches must be caught ("Di buku 68, Bu.", never
// "salah") and 0 wrong grades saved.
//
// Needs the stack running with the offline AI and the wa-bot secret, e.g.
//   NEMU_RESPONDER=fixture WA_BOT_SECRET=<32+ chars> pnpm dev
// WS-07 connected to the mock is optional: without it the read-back compares what the page shows.
// Screenshots go to .output/verify-f1-2/.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const WA_BOT_SECRET = process.env.WA_BOT_SECRET;
const HEADED = process.argv.includes("--headed");
// Bu Siti in WS-06 (synthetic): her WhatsApp number and her AlurSekolah email.
const PHONE = "6281200001001";
const EMAIL = "siti.aminah@sditnusantara.sch.id";

if (!WA_BOT_SECRET) {
  console.error("Set WA_BOT_SECRET to the secret the running Nemu Service was started with.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const photo = resolve(root, "../../packages/ai/src/school/fixtures/f1-1-buku-nilai-4b.jpg");
const extension = join(root, ".output/verify-f1-2-extension");
const shots = join(root, ".output/verify-f1-2");
mkdirSync(shots, { recursive: true });

// F1-2's scenario: the book (the official F1-1 page, in the mock's 4B order) and what the teacher types
// first in cara 2. Two rows are deliberately off.
const SCENARIO = readFileSync(
  join(root, "features/grade-photo/lib/F1-2_cara-2_skenario.csv"),
  "utf8",
)
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [, name, book, note, firstTyped] = line.split(",");
    return { name, book, note, firstTyped };
  });
const OFF = SCENARIO.filter((row) => row.firstTyped !== row.book);
const firstName = (name) => name.split(" ")[0];
/** The row Nemu means by "untuk Dimas" (first name, or the full name when it isn't unique). */
function rowFor(spoken) {
  return (
    SCENARIO.find((row) => row.name === spoken) ??
    SCENARIO.find(
      (row) =>
        firstName(row.name) === spoken &&
        SCENARIO.filter((other) => firstName(other.name) === spoken).length === 1,
    )
  );
}

async function service(procedure) {
  const response = await fetch(`${SERVER}/rpc/${procedure.name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nemu-install-code": INSTALL_CODE,
      "x-nemu-email": EMAIL,
    },
    body: JSON.stringify({ json: procedure.input ?? null }),
  });
  return (await response.json()).json;
}

async function resetMock() {
  await fetch(new URL("_mock/reset", MOCK), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

// Start clean: no photo left from an earlier run.
for (const job of await service({ name: "inboxJobs" }))
  await service({ name: "inboxAck", input: { jobId: job.jobId } });

execFileSync("pnpm", ["exec", "wxt", "build", "--mode", "development"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WXT_SERVER_URL: SERVER },
});
rmSync(extension, { recursive: true, force: true });
cpSync(join(root, ".output/chrome-mv3-dev"), extension, { recursive: true });

let failed = false;
let page;
async function check(name, run) {
  try {
    await run();
    console.log(`✔ ${name}`);
  } catch (error) {
    failed = true;
    await page
      ?.screenshot({ path: join(shots, `failed-${name.slice(0, 24)}.png`) })
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

page = await context.newPage();
await page.goto(new URL("?uji-nemu#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

const overlay = page.locator("nemu-overlay");
const dock = overlay.getByLabel("Uji executor Nemu");
const display = (type) => overlay.locator(`[data-nemu-display='${type}']`);
const typeBox = overlay.getByRole("textbox");
const photoCard = overlay
  .getByRole("region", { name: "Pilihan Nemu" })
  .filter({ hasText: "Foto dari WhatsApp" });
await dock.waitFor({ timeout: 10_000 });

async function sendPhoto() {
  const form = new FormData();
  form.set("phone", PHONE);
  form.set("messageId", `verify-f1-2-${Date.now()}`);
  form.set("photo", new Blob([readFileSync(photo)], { type: "image/jpeg" }), "buku-nilai.jpg");
  const sent = await (
    await fetch(`${SERVER}/api-reference/wa-bot/photos`, {
      method: "POST",
      headers: { authorization: `Bearer ${WA_BOT_SECRET}` },
      body: form,
    })
  ).json();
  expect(sent.status === "queued", `wa-bot photo was ${sent.status}`);
  return sent.jobId;
}

/** The photo, the command and W5's questions, answered from the book, up to the cara 1 fill. */
async function upToTheFill() {
  await photoCard.waitFor({ timeout: 15_000 });
  await photoCard.getByRole("button", { name: "Mulai" }).click();
  // #270: "Ini nilai apa, Bu?" offers the photo's title; typing the command instead still works.
  await display("pilih")
    .filter({ hasText: "Ini nilai apa, Bu?" })
    .getByRole("button", { name: "UTS · Matematika · 4B" })
    .waitFor({ timeout: 15_000 });
  await typeBox.fill("Nemu, masukkan nilai UTS Matematika 4B");
  await typeBox.press("Enter");
  await display("pilih").filter({ hasNotText: "Ini nilai apa" }).waitFor({ timeout: 60_000 });
  let last = "";
  for (let asked = 0; asked < 20;) {
    const card = display("pilih");
    if (!(await card.isVisible().catch(() => false))) break;
    const prompt = (await card.locator("[data-slot=card-title]").textContent()).trim();
    if (prompt === last) {
      await page.waitForTimeout(100);
      continue;
    }
    last = prompt;
    asked += 1;
    const buttons = card.getByRole("group").getByRole("button");
    const digit = prompt.match(/^Nilai (.+?)(?:: | berapa\?$)/u);
    if (digit) {
      const book = SCENARIO.find((row) => row.name === digit[1]).book;
      const offered = buttons.filter({ hasText: new RegExp(`^${book}$`, "u") });
      if (await offered.count()) await offered.click();
      else {
        // A smudged digit has no reading to offer: "Angka lain", then the book's number typed.
        await buttons.filter({ hasText: "Angka lain" }).click();
        await display("jawab")
          .getByText(new RegExp(`Berapa nilai ${digit[1]}`, "u"))
          .waitFor();
        await typeBox.fill(book);
        await typeBox.press("Enter");
      }
    } else if (/S \(sakit\)/u.test(prompt)) await buttons.filter({ hasText: "Kosongkan" }).click();
    else await buttons.first().click();
  }
  await display("kerja")
    .getByText(/Nemu mengisi · 3 dari \d+/u)
    .waitFor({ timeout: 60_000 });
}

/** The words of what Nemu shows while it points. */
/** The sentence of the Gelembung Tunjuk: without its heading, detail line, chip or links. */
async function pointing() {
  const text = await display("tunjuk")
    .first()
    .evaluate(
      (node) => {
        const copy = node.cloneNode(true);
        for (const extra of copy.querySelectorAll(
          "[data-nemu-status], [data-nemu-detail], [data-nemu-chip]",
        ))
          extra.remove();
        return copy.textContent;
      },
      null,
      { timeout: 500 },
    )
    .catch(() => null);
  return text?.replace(/Lihat ringkasan.*$/su, "").trim() ?? null;
}

/**
 * Bu Siti in cara 2: types what Nemu says into the field it names and leaves it (Tab), except the
 * scenario's first value on its two rows. Returns every sentence Nemu said while pointing.
 */
async function teacherInCaraTwo() {
  const said = [];
  const tried = new Set();
  let handled = null;
  let row = null;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const sentence = await pointing();
    if (!sentence || sentence === handled) {
      await page.waitForTimeout(80);
      continue;
    }
    handled = sentence;
    said.push(sentence);
    if (sentence === "Silakan Ibu tekan Simpan.") return said;
    let field;
    let value;
    const grade = sentence.match(/^Ketik (\d+) untuk (.+)\.$/u);
    const note = sentence.match(/Di Catatan (.+), tulis (.+)\.$/u);
    const correction = sentence.match(/^Di buku (\d+), Bu\.$/u);
    if (grade) {
      row = rowFor(grade[2]);
      expect(row, `no student for "${sentence}"`);
      expect(
        grade[1] === row.book,
        `Nemu said ${grade[1]} for ${row.name}; the book has ${row.book}`,
      );
      field = `Nilai ${row.name}`;
      value = tried.has(field) ? row.book : row.firstTyped;
      tried.add(field);
    } else if (note) {
      row = SCENARIO.find((item) => item.name === note[1]);
      expect(row && note[2] === row.note, `unexpected note line "${sentence}"`);
      field = `Catatan ${row.name}`;
      value = row.note;
    } else if (correction) {
      expect(row && correction[1] === row.book, `"${sentence}" isn't the book's ${row?.book}`);
      // F1·10: the line under it says what she typed.
      const typed = await page.getByLabel(`Nilai ${row.name}`, { exact: true }).inputValue();
      await display("tunjuk")
        .getByText(`Ibu mengetik ${typed}. Ganti dulu, lalu lanjut.`)
        .waitFor({ timeout: 3000 });
      await page.screenshot({ path: join(shots, `beda-${row.name.split(" ")[0]}.png`) });
      field = `Nilai ${row.name}`;
      value = row.book;
    } else continue;
    const input = page.getByLabel(field, { exact: true });
    await input.fill(value);
    await input.press("Tab");
  }
  throw new Error(`cara 2 didn't reach Simpan; last: ${said.at(-1)}`);
}

async function scenario(how) {
  const label = how === "ambil-alih" ? "taking over" : "Ajari saya";
  await resetMock();
  await page.locator("#menu-beranda").click();
  const jobId = await sendPhoto();
  let said = [];

  await check(`${label}: the photo, W5 and cara 1 start as in F1-1`, upToTheFill);

  await check(`${label}: the remaining rows switch to cara 2`, async () => {
    if (how === "ambil-alih") {
      await page.locator("h1").first().click();
      const card = display("pilih");
      await card.getByText("Ibu mau isi sendiri?").waitFor({ timeout: 3000 });
      await page.screenshot({ path: join(shots, `${how}-kartu-pilih.png`) });
      await card.getByRole("button", { name: "Ya, saya isi sendiri" }).click();
    } else await dock.getByRole("button", { name: "Ajari saya" }).click();
    await display("tunjuk")
      .getByText(/^(Ketik \d+ untuk|Di Catatan|Untuk )/u)
      .first()
      .waitFor({ timeout: 10_000 });
    // F1·09: Giliran Ibu counts the students; the line under it names the lit field.
    await display("tunjuk")
      .locator("[data-nemu-status]")
      .filter({ hasText: /^Giliran Ibu\d+ dari 32$/u })
      .waitFor({ timeout: 3000 });
    await display("tunjuk")
      .getByText(/Kolom .+ bersinar oranye\.$/u)
      .waitFor({ timeout: 3000 });
    await page.screenshot({ path: join(shots, `${how}-cara-2.png`) });
  });

  await check(
    `${label}: Nemu says each grade from the book and catches both deliberate mismatches`,
    async () => {
      said = await teacherInCaraTwo();
      const corrections = said.filter((line) => line.startsWith("Di buku"));
      console.log(`  Nemu pointed ${said.length} times; corrections: ${corrections.join(" | ")}`);
      expect(
        corrections.length === OFF.length &&
          OFF.every((row) => corrections.includes(`Di buku ${row.book}, Bu.`)),
        `corrections: ${corrections.join(", ") || "none"}`,
      );
      expect(!said.some((line) => /salah/iu.test(line)), "Nemu said 'salah'");
      expect(
        said.some((line) => line.startsWith("Untuk Raka dikosongkan saja.")),
        "Raka Aditya's blank grade wasn't said",
      );
      for (const row of SCENARIO) {
        const nilai = await page.getByLabel(`Nilai ${row.name}`, { exact: true }).inputValue();
        expect(nilai === row.book, `${row.name}: ${nilai} on the page, the book has ${row.book}`);
        const note = await page.getByLabel(`Catatan ${row.name}`, { exact: true }).inputValue();
        expect(note === row.note, `${row.name}'s note: "${note}", not "${row.note}"`);
      }
      await page.screenshot({ path: join(shots, `${how}-simpan.png`) });
    },
  );

  await check(
    `${label}: the teacher saves; read-back, photo deleted, Catatan langkah`,
    async () => {
      await page.locator("#btn-simpan").click();
      await page.locator("#ya-simpan").click();
      await page.getByText("Nilai tersimpan.").waitFor();
      const answer = display("jawab");
      await answer.getByText("Tersimpan").waitFor({ timeout: 30_000 });
      const left = await service({ name: "inboxJobs" });
      expect(!left.some((job) => job.jobId === jobId), "the photo is still in the inbox");
      await answer.getByRole("button", { name: "Catatan langkah" }).click();
      const notes = overlay.getByRole("region", { name: "Catatan langkah" });
      await notes
        .getByText(
          /^Bu mengetik \d+ isian, Nemu memeriksa; 2 sempat berbeda dan sudah dibetulkan$/u,
        )
        .waitFor({ timeout: 5000 });
      await page.screenshot({ path: join(shots, `${how}-catatan-langkah.png`) });
      await notes.getByRole("button", { name: "Tutup" }).click();
    },
  );

  await check(`${label}: F1-2, 0 wrong grades saved in AlurSekolah`, async () => {
    const saved = await (
      await fetch(new URL("_mock/nilai", MOCK), { headers: { accept: "application/json" } })
    ).json();
    const rows = saved["4B|Matematika|UTS"] ?? {};
    const wrong = SCENARIO.filter((row) => String(rows[row.name]?.nilai ?? "") !== row.book);
    expect(wrong.length === 0, `wrong: ${wrong.map((row) => row.name).join(", ")}`);
  });
}

await scenario("ambil-alih");
await scenario("ajari-saya");

await context.close();
console.log(failed ? "\nSome checks failed." : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
