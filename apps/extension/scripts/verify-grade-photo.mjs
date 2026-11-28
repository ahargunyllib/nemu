// F1-1 on the mock AlurSekolah (#207): loads a development build of the extension into
// Playwright's Chromium, sends the official F1-1 grade-book photo the way apps/wa-bot does, and walks
// the whole flow as Bu Siti: the card in one tab only with the photo's thumbnail (#278) and no read
// before Mulai, Bu Dewi refused the thumbnail, Mulai, "Ini nilai apa, Bu?" with the
// photo's title as the choice (#270), W5's questions (by button, and once by "Angka lain" and typing), the cara 1 fill with
// visible navigation, Simpan pressed by the "teacher", the read-back, inboxAck (photo and thumbnail
// gone), Catatan langkah.
// It checks every saved grade against the page's truth (0 wrong) and the time (≤ 5 minutes).
//
// Needs the stack running with the offline AI and the wa-bot secret, e.g.
//   NEMU_RESPONDER=fixture WA_BOT_SECRET=<32+ chars> pnpm dev
// and WS-07 connected to the mock (Admin › Integrasi: http://localhost:3003, the mock's key) for
// the AlurSekolah read-back; without it the read-back compares what the page shows instead.
// Screenshots go to .output/verify-grade-photo/.
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
// Another registered teacher of the same school (WS-06 seed), who must not see Bu Siti's photo.
const OTHER_EMAIL = "dewi.lestari@sditnusantara.sch.id";

if (!WA_BOT_SECRET) {
  console.error("Set WA_BOT_SECRET to the secret the running Nemu Service was started with.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const photo = resolve(root, "../../packages/ai/src/school/fixtures/f1-1-buku-nilai-4b.jpg");
// What apps/wa-bot's internal/thumbnail makes of that photo (320 px on its long side).
const thumbnail = resolve(
  root,
  "../../packages/ai/src/school/fixtures/f1-1-buku-nilai-4b-thumbnail.jpg",
);
const extension = join(root, ".output/verify-grade-photo-extension");
const shots = join(root, ".output/verify-grade-photo");
mkdirSync(shots, { recursive: true });

// The truth of the official F1-1 page (F1-1_kunci-jawaban.csv), in 01_profil-sekolah's 4B order
// (KKM 75). Raka is S (sakit).
const CLASS_4B = [
  ["Ahmad Fadli", 62],
  ["Aisyah Zahra", 82],
  ["Alya Nur Fitri", 90],
  ["Bagas Saputra", 68],
  ["Budi Santoso", 77],
  ["Citra Ayu Lestari", 64],
  ["Dimas Pratama", 85],
  ["Dinda Maharani", 87],
  ["Fahri Hidayat", 73],
  ["Farah Annisa", 71],
  ["Galih Ramadhan", 69],
  ["Hana Salsabila", 81],
  ["Ilham Maulana", 90],
  ["Intan Permata", 65],
  ["Kevin Ardiansyah", 72],
  ["Laila Nur Azizah", 64],
  ["Muhammad Rizky", 63],
  ["Nabila Putri Ramadhani", 80],
  ["Naufal Akbar", 73],
  ["Nur Aini", 83],
  ["Putra Wijaya", 77],
  ["Qonita Rahma", 79],
  ["Raka Aditya", null],
  ["Rani Oktaviani", 82],
  ["Salsabila Putri", 77],
  ["Siti Nur Haliza", 85],
  ["Taufik Hidayatullah", 85],
  ["Tiara Anjani", 94],
  ["Umar Faruq", 64],
  ["Vina Amelia", 63],
  ["Yusuf Alfarizi", 82],
  ["Zahra Khairunnisa", 90],
];
const TRUTH = new Map(CLASS_4B);

async function service(procedure, email = EMAIL) {
  const response = await fetch(`${SERVER}/rpc/${procedure.name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nemu-install-code": INSTALL_CODE,
      "x-nemu-email": email,
    },
    body: JSON.stringify({ json: procedure.input ?? null }),
  });
  return (await response.json()).json;
}

// Start clean: no photo left from an earlier run, no grades saved in the mock.
for (const job of await service({ name: "inboxJobs" }))
  await service({ name: "inboxAck", input: { jobId: job.jobId } });
await fetch(new URL("_mock/reset", MOCK), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

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

async function signedInTab() {
  const tab = await context.newPage();
  await tab.goto(new URL("#/keluar", MOCK).href);
  await tab.locator("#username").fill("siti.aminah");
  await tab.locator("#password").fill("nemu-uji-2026");
  await tab.locator("#btn-masuk").click();
  await tab.locator("#menu-email").filter({ hasText: "@" }).waitFor();
  await tab.locator("nemu-overlay").getByRole("button", { name: "Tanya Nemu" }).waitFor();
  return tab;
}
const tabs = [await signedInTab(), await signedInTab()];
const cardIn = (tab) =>
  tab.locator("nemu-overlay").getByRole("region", { name: "Pilihan Nemu" }).filter({
    hasText: "Foto dari WhatsApp",
  });

// apps/wa-bot's call: the photo from Bu Siti's number.
const form = new FormData();
form.set("phone", PHONE);
form.set("messageId", `verify-f1-${Date.now()}`);
form.set("photo", new Blob([readFileSync(photo)], { type: "image/jpeg" }), "buku-nilai.jpg");
form.set("thumbnail", new Blob([readFileSync(thumbnail)], { type: "image/jpeg" }), "thumbnail");
const sent = await (
  await fetch(`${SERVER}/api-reference/wa-bot/photos`, {
    method: "POST",
    headers: { authorization: `Bearer ${WA_BOT_SECRET}` },
    body: form,
  })
).json();
const jobId = sent.jobId;

await check("the photo shows as the small Foto dari WhatsApp card, in one tab only", async () => {
  expect(sent.status === "queued", `wa-bot photo was ${sent.status}`);
  const winner = await Promise.race(
    tabs.map((tab) =>
      cardIn(tab)
        .waitFor({ timeout: 15_000 })
        .then(() => tab),
    ),
  );
  const other = tabs.find((tab) => tab !== winner);
  // Both tabs keep polling every 4 s; the other never shows it.
  await winner.waitForTimeout(9000);
  expect((await cardIn(other).count()) === 0, "the card shows in both tabs");
  expect((await cardIn(winner).count()) === 1, "the card went away");
  page = winner;
  await other.close();
});

await check(
  "the card shows the photo's thumbnail, and nothing is read before Mulai (#278)",
  async () => {
    const image = cardIn(page).getByRole("img", { name: "Foto buku nilai dari WhatsApp" });
    await image.waitFor({ timeout: 10_000 });
    const shown = await image.evaluate((element) => ({
      width: element.naturalWidth,
      height: element.naturalHeight,
      src: element.src.slice(0, 23),
    }));
    expect(
      shown.src === "data:image/jpeg;base64," && shown.width === 230 && shown.height === 320,
      `thumbnail ${JSON.stringify(shown)}`,
    );
    const [job] = await service({ name: "inboxJobs" });
    expect(
      job?.jobId === jobId && job.status === "queued" && job.reading === null,
      `job ${job?.status}`,
    );
    await page.screenshot({ path: join(shots, "kartu-foto.png") });
    await cardIn(page).screenshot({ path: join(shots, "kartu-foto-dekat.png") });
  },
);

await check("another teacher can't fetch the thumbnail (#278)", async () => {
  const response = await fetch(`${SERVER}/rpc/inboxThumbnail`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nemu-install-code": INSTALL_CODE,
      "x-nemu-email": OTHER_EMAIL,
    },
    body: JSON.stringify({ json: { jobId } }),
  });
  const body = await response.json();
  expect(
    response.status === 404 && body.json?.code === "NOT_FOUND",
    `Bu Dewi got ${response.status}`,
  );
  expect((await service({ name: "inboxJobs" }, OTHER_EMAIL)).length === 0, "Bu Dewi sees the job");
});

const overlay = page.locator("nemu-overlay");
const display = (type) => overlay.locator(`[data-nemu-display='${type}']`);
// The heading (Kepala) with its words and, when given, the count on its right ("3 dari 32").
// Matched apart: the progress bar under the count adds text of its own.
const heading = (type, text, count) => {
  const words = display(type).locator("[data-nemu-status]").filter({ hasText: text });
  return count ? words.filter({ hasText: new RegExp(`(^|\\D)${count}`, "u") }) : words;
};
const typeBox = overlay.getByRole("textbox");
const started = Date.now();

await check(
  "Mulai asks Ini nilai apa, Bu? with the photo's title; picking it reads the photo (#270)",
  async () => {
    await cardIn(page).getByRole("button", { name: "Mulai" }).click();
    const pick = display("pilih").filter({ hasText: "Ini nilai apa, Bu?" });
    await pick.waitFor({ timeout: 15_000 });
    const labels = await pick.getByRole("group").getByRole("button").allTextContents();
    expect(
      JSON.stringify(labels) === JSON.stringify(["UTS · Matematika · 4B", "Nilai lain"]),
      `choices: ${labels.join(", ")}`,
    );
    expect(await typeBox.isVisible(), "no type box under the Kartu Pilih");
    await page.screenshot({ path: join(shots, "pilih-judul.png") });
    await pick.getByRole("button", { name: "UTS · Matematika · 4B" }).click();
    await display("pilih").filter({ hasNotText: "Ini nilai apa" }).waitFor({ timeout: 60_000 });
  },
);

const questions = [];
await check(
  "W5: one Kartu Pilih per question with the photo crop, nothing pre-selected",
  async () => {
    for (let index = 0; index < 20; index += 1) {
      const card = display("pilih");
      if (!(await card.isVisible().catch(() => false))) break;
      const prompt = (await card.locator("[data-slot=card-title]").textContent()).trim();
      if (questions.at(-1)?.prompt === prompt) {
        await page.waitForTimeout(100);
        continue;
      }
      const note = await card.locator("[data-slot=card-footer]").textContent();
      const buttons = card.getByRole("group").getByRole("button");
      const labels = await buttons.allTextContents();
      const image = await card.getByRole("img").count();
      questions.push({ prompt, labels, image });
      expect(/Pertanyaan \d+ dari \d+\. 22 nilai lain sudah cocok\./u.test(note), `note: ${note}`);
      expect(labels.length >= 2 && labels.length <= 3, `${labels.length} buttons`);
      if (index === 0) await page.screenshot({ path: join(shots, "w5-nama.png") });
      if (index === 1) await page.screenshot({ path: join(shots, "w5-angka.png") });

      const digit = prompt.match(/^Nilai (.+?)(?:: | berapa\?$)/u);
      if (digit) {
        expect(labels.includes("Angka lain"), "no Angka lain");
        const truth = String(TRUTH.get(digit[1]));
        // Farah's 71 by "Angka lain" and typing, as does Nur Aini's smudged 83 (no reading offered).
        if (digit[1] === "Farah Annisa" || !labels.includes(truth)) {
          await buttons.filter({ hasText: "Angka lain" }).click();
          await display("jawab")
            .getByText(new RegExp(`Berapa nilai ${digit[1]}`, "u"))
            .waitFor();
          await typeBox.fill(truth);
          await typeBox.press("Enter");
        } else await buttons.filter({ hasText: new RegExp(`^${truth}$`, "u") }).click();
      } else if (/S \(sakit\)/u.test(prompt)) {
        await buttons.filter({ hasText: "Kosongkan" }).click();
      } else {
        // A name spelled differently: the roster name Nemu offers first.
        expect(labels.includes("Tidak ada di daftar"), "no Tidak ada di daftar");
        await buttons.first().click();
      }
      await page.waitForTimeout(150);
    }
    const digits = questions.filter((question) => question.prompt.startsWith("Nilai "));
    expect(digits.length === 4, `${digits.length} doubtful cells asked, not 4`);
    expect(questions.length === 10, `${questions.length} questions, not 10`);
    expect(
      digits.every((question) => question.image === 1),
      "a digit question has no crop",
    );
  },
);

await check("cara 1 says each navigation step: Langkah 1 and 2 of 3 (F1·05a–06b)", async () => {
  const working = display("kerja");
  await working.getByText("Saya buka menu Nilai, Bu.").waitFor({ timeout: 30_000 });
  await heading("kerja", "Nemu bekerja", "Langkah 1 dari 3").waitFor();
  await page.screenshot({ path: join(shots, "navigasi-berangkat.png") });
  await working.getByText("Ini menu Nilai.").waitFor({ timeout: 10_000 });
  await working.getByText("Saya klik, Bu.").waitFor();
  await page.screenshot({ path: join(shots, "navigasi-menu.png") });
  await working.getByText("Ini Isi nilai kelas 4B.").waitFor({ timeout: 15_000 });
  await working.getByText("Kelas 4B, Matematika, UTS sudah saya pilih.").waitFor();
  await heading("kerja", "Nemu bekerja", "Langkah 2 dari 3").waitFor();
  await page.screenshot({ path: join(shots, "navigasi-tampilkan.png") });
});

await check("cara 1 opens Isi nilai kelas through the menu and fills every value", async () => {
  // F1·07 (P1-5): each of the first three students said, with how to take over; the count is
  // students (32), not the values and notes Nemu types.
  const working = display("kerja");
  await working.getByText("Alya Nur Fitri, 90.").waitFor({ timeout: 30_000 });
  await working.getByText("Klik atau ketik kalau Ibu mau isi sendiri.").waitFor();
  await heading("kerja", "Nemu mengisi", "3 dari 32").waitFor();
  await page.waitForURL(/#\/nilai$/u);
  await page.screenshot({ path: join(shots, "mengisi.png") });
  await working.getByText("Sisanya saya isi lebih cepat, Bu.").waitFor({ timeout: 15_000 });
  await working.getByText("Tekan Pelan untuk melihat satu per satu.").waitFor();
  await page.screenshot({ path: join(shots, "mengisi-lebih-cepat.png") });
  await display("tunjuk").getByText("Silakan Ibu tekan Simpan.").waitFor({ timeout: 180_000 });
  expect(!(await page.locator("#konfirmasi").isVisible()), "Simpan was pressed by Nemu");
  for (const [name, value] of CLASS_4B) {
    const typed = await page.getByLabel(`Nilai ${name}`, { exact: true }).inputValue();
    expect(typed === (value === null ? "" : String(value)), `${name}: ${typed}, not ${value}`);
    const note = await page.getByLabel(`Catatan ${name}`, { exact: true }).inputValue();
    const expected = value === null ? "tidak hadir" : value < 75 ? "remedial" : "";
    expect(note === expected, `${name}'s note: "${note}", not "${expected}"`);
  }
});

await check("Nemu points at Simpan; the numbers are behind Lihat ringkasan", async () => {
  await display("tunjuk").getByRole("button", { name: "Lihat ringkasan" }).click();
  await display("tunjuk")
    .getByText(/Ahmad Fadli 62 \(remedial\), Aisyah Zahra 82/u)
    .waitFor();
  await page.screenshot({ path: join(shots, "tunjuk-simpan.png") });
});

await check(
  "the teacher saves; the read-back is said in one sentence and the photo is deleted",
  async () => {
    await page.locator("#btn-simpan").click();
    await page.locator("#ya-simpan").click();
    await page.getByText("Nilai tersimpan.").waitFor();
    const answer = display("jawab");
    await answer.getByText("Tersimpan").waitFor({ timeout: 30_000 });
    const sentence = await answer.textContent();
    console.log(
      `  read-back: ${sentence.replace(/Tersimpan|Catatan langkah|Lihat ringkasan/gu, "").trim()}`,
    );
    await page.screenshot({ path: join(shots, "baca-ulang.png") });
    const left = await service({ name: "inboxJobs" });
    expect(!left.some((job) => job.jobId === jobId), "the photo is still in the inbox");
    // F1-12: its thumbnail went with it.
    const after = await fetch(`${SERVER}/rpc/inboxThumbnail`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nemu-install-code": INSTALL_CODE,
        "x-nemu-email": EMAIL,
      },
      body: JSON.stringify({ json: { jobId } }),
    });
    expect(after.status === 404, `the thumbnail is still served (${after.status})`);
  },
);

await check("Catatan langkah shows at the end", async () => {
  await display("jawab").getByRole("button", { name: "Catatan langkah" }).click();
  const notes = overlay.getByRole("region", { name: "Catatan langkah" });
  await notes.getByText("Bu menjawab 10 pertanyaan tentang foto").waitFor({ timeout: 5000 });
  await notes.getByText("Bu menekan Simpan").waitFor();
  await notes.getByText(/Nemu membaca ulang 32 nilai dari AlurSekolah: semua sesuai/u).waitFor();
  await notes.getByText("Foto buku nilai dihapus dari Nemu").waitFor();
  await page.screenshot({ path: join(shots, "catatan-langkah.png") });
});

await check("F1-1: 0 wrong grades saved in AlurSekolah, in under 5 minutes", async () => {
  const minutes = (Date.now() - started) / 60_000;
  console.log(`  Mulai to Catatan langkah: ${minutes.toFixed(1)} min`);
  expect(minutes <= 5, `${minutes.toFixed(1)} minutes`);
  const saved = await (
    await fetch(new URL("_mock/nilai", MOCK), { headers: { accept: "application/json" } })
  ).json();
  const rows = saved["4B|Matematika|UTS"] ?? {};
  for (const [name, value] of CLASS_4B) {
    const stored = String(rows[name]?.nilai ?? "");
    expect(
      stored === (value === null ? "" : String(value)),
      `${name} saved ${stored}, not ${value}`,
    );
  }
});

await context.close();
console.log(failed ? "\nSome checks failed." : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
