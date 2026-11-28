// Loads a production build of the extension into Playwright's Chromium and checks F4-2 (#210) end
// to end on the Moodle test site (infra/): on course 4A-UJI Bu Siti says "Nemu, masukkan kuis dari
// naskah ini ke Moodle. Buka Senin 7 Desember, tutup Kamis 10 Desember." and picks Richard's
// script (infra/setup/f4-2/F4-2_naskah-ipas-10-soal.pdf). Nemu says it uses 00.00 and 23.59, then in
// cara 1 turns on Mode Edit, adds a Kuis in IPAS, fills its name and times and points at Simpan dan
// tampilkan, which she presses. It opens the quiz's Bank soal › Impor, drops the XML on the picker
// (the spike) and points at Impor; then Soal › Tambah › dari bank soal, and she presses Tambahkan.
// The F4-1 check runs on the new quiz (she presses Pratinjau kuis) and Nemu reports in one sentence.
// Afterwards the Moodle database must hold 10/10 questions as in F4-2_hasil-yang-diharapkan.xml
// (words, choices, key, and soal 7's three pictures pixel for pixel), opening Monday 7 December
// 00.00 and closing Thursday 10 December 2026 23.59 (Asia/Jakarta).
// Needs `NEMU_RESPONDER=fixture pnpm dev` and the Moodle test site; skips with a message when
// Moodle isn't running. A local run first removes an earlier run's quiz (infra/setup/reset-f4-2.php).
// Screenshots: .output/verify-f4-2/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";

import { chromium, request } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const MOODLE = process.env.MOODLE_URL ?? "https://localhost/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const QUIZ = "Latihan IPAS Kelas 4A";
const UTTERANCE =
  "Nemu, masukkan kuis dari naskah ini ke Moodle. Buka Senin 7 Desember, tutup Kamis 10 Desember.";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const infra = resolve(root, "../../infra");
const pack = join(infra, "setup/f4-2");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f4-2");
mkdirSync(shots, { recursive: true });

const probe = await request.newContext({ ignoreHTTPSErrors: true });
const reachable = await probe
  .get(new URL("login/index.php", MOODLE).href, { timeout: 5000 })
  .then((response) => response.ok())
  .catch(() => false);
await probe.dispose();
if (!reachable) {
  console.log(
    `Skipped: the Moodle test site isn't running at ${MOODLE}. Start it from infra/ with ` +
      "`docker compose up -d caddy postgres moodle` and `./setup-4a-uji.sh` (infra/README.md, " +
      "“Running it on your laptop”), or set MOODLE_URL and MOODLE_TEACHER_PASSWORD.",
  );
  process.exit(0);
}

function envFile() {
  const file = join(infra, ".env");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}
const TEACHER_PASSWORD = process.env.MOODLE_TEACHER_PASSWORD ?? envFile().TEACHER_PASSWORD;
if (!TEACHER_PASSWORD) {
  console.log("✘ Set MOODLE_TEACHER_PASSWORD (or TEACHER_PASSWORD in infra/.env) for siti.aminah.");
  process.exit(1);
}

/** A command in the local Moodle stack (infra/compose.yaml); null when it isn't reachable. */
function compose(args, input) {
  try {
    return execFileSync("docker", ["compose", ...args], {
      cwd: infra,
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

const FIELD = "\u001f";
const RECORD = "\u001e";
function sql(query) {
  const out = compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "moodle",
    "-d",
    "moodle",
    "-At",
    "-F",
    FIELD,
    "-R",
    RECORD,
    "-c",
    query,
  ]);
  if (out === null) return null;
  return out
    .toString("utf8")
    .replace(/\n$/u, "")
    .split(RECORD)
    .filter(Boolean)
    .map((row) => row.split(FIELD));
}

// A local run starts from a course without an earlier run's quiz.
const local = sql("SELECT 1") !== null;
if (local) {
  compose(["cp", join(infra, "setup") + "/.", "moodle:/tmp/nemu-setup"]);
  const reset = compose(["exec", "-T", "moodle", "php", "/tmp/nemu-setup/reset-f4-2.php"]);
  console.log(`  ${reset?.toString().trim() ?? "F4-2 reset failed"}`);
} else {
  console.log(`  The Moodle database isn't reachable: delete "${QUIZ}" from 4A-UJI by hand first.`);
}

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
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
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
const display = (type) => overlay.locator(`[data-nemu-display='${type}']`);

// Moodle shows no AlurSekolah account, so Nemu asks as the last one seen there (ADR-0015).
await page.goto(new URL("#/keluar", MOCK).href);
await page.locator("#username").fill("siti.aminah");
await page.locator("#password").fill("nemu-uji-2026");
await page.locator("#btn-masuk").click();
await page.locator("#menu-email").filter({ hasText: "@" }).waitFor();

await page.goto(new URL("login/logout.php", MOODLE).href);
await page.goto(new URL("login/index.php", MOODLE).href);
if (await page.locator("#username").count()) {
  await page.locator("#username").fill("siti.aminah");
  await page.locator("#password").fill(TEACHER_PASSWORD);
  await page.locator("#loginbtn").click();
  await page.waitForLoadState();
}
await page.goto(new URL("course/view.php?name=4A-UJI", MOODLE).href);

/** Whether Nemu's ring (Sorot arahkan) sits on the element. */
async function ringsOn(locator) {
  const ring = await overlay.locator("[data-nemu-ring]").boundingBox();
  const box = await locator.boundingBox();
  if (!ring || !box) return false;
  const [x, y] = [ring.x + ring.width / 2, ring.y + ring.height / 2];
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/** After a click on the Nemu button: Tanya Nemu when it shows its menu, so the type box opens. */
async function openTypeBox(overlay) {
  const typeBox = overlay.getByLabel("Pertanyaan untuk Nemu");
  const ask = overlay.getByRole("button", { name: /^Tanya Nemu \(/u });
  await typeBox.or(ask).first().waitFor({ timeout: 10_000 });
  if (await ask.count()) await ask.click();
}

/** Nemu points (Gelembung Tunjuk) with `sentence`; the ring is on `button`, and she presses it. */
async function shePresses(sentence, button, shot) {
  await display("tunjuk").getByText(sentence, { exact: false }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(900);
  expect(await ringsOn(button), `the ring isn't on the button for “${sentence}”`);
  await page.screenshot({ path: join(shots, shot) });
  for (let waited = 0; waited < 10_000 && (await button.isDisabled()); waited += 250)
    await page.waitForTimeout(250);
  await button.click();
}

const visited = [];
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
});

await check("Bu Siti asks on the course page and picks her script", async () => {
  const closed = overlay.locator("button[aria-label='Tanya Nemu']");
  await closed.waitFor({ timeout: 15_000 });
  await closed.click();
  // With kept Catatan langkah the Nemu button asks "Mau buka apa?" first (F1·12a).
  await openTypeBox(overlay);
  await overlay.getByLabel("Pertanyaan untuk Nemu").fill(UTTERANCE);
  await overlay.getByRole("button", { name: "Kirim" }).click();
  const pick = display("jawab").getByRole("button", { name: "Pilih naskah" });
  await pick.waitFor({ timeout: 15_000 });
  await page.screenshot({ path: join(shots, "1-pilih-naskah.png") });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), pick.click()]);
  await chooser.setFiles(join(pack, "F4-2_naskah-ipas-10-soal.pdf"));
});

await check("Nemu reads 10 questions, asks nothing, and says it uses 00.00 and 23.59", async () => {
  const sentence =
    "Jamnya tidak disebut, jadi kuis dibuka 7 Desember pukul 00.00 dan ditutup 10 Desember pukul 23.59, Bu.";
  await display("jawab").getByText(sentence).waitFor({ timeout: 30_000 });
  await display("jawab").getByText("10 soal siap", { exact: false }).waitFor();
  expect(!(await display("pilih").count()), "Nemu asked about the script");
  await page.screenshot({ path: join(shots, "2-siap.png") });
  await display("jawab").getByRole("button", { name: "Masukkan ke Moodle" }).click();
});

await check(
  "Cara 1: Mode Edit, Tambahkan konten in IPAS, Kuis; name and times filled; she presses Simpan dan tampilkan",
  async () => {
    await page.waitForURL(/\/course\/modedit\.php/u, { timeout: 60_000 });
    const save = page.getByRole("button", { name: "Simpan dan tampilkan", exact: true });
    await display("tunjuk")
      .getByText("Tekan Simpan dan tampilkan, Bu.", { exact: false })
      .waitFor({ timeout: 90_000 });
    const values = await page.evaluate(() => {
      const value = (id) => document.getElementById(id)?.value;
      const checked = (id) => document.getElementById(id)?.checked;
      const time = (field) =>
        ["year", "month", "day", "hour", "minute"]
          .map((part) => value(`id_${field}_${part}`))
          .join("-");
      return {
        name: value("id_name"),
        open: checked("id_timeopen_enabled") && time("timeopen"),
        close: checked("id_timeclose_enabled") && time("timeclose"),
        section: new URL(location.href).searchParams.get("section"),
      };
    });
    console.log(`  Form: ${JSON.stringify(values)}`);
    expect(values.name === QUIZ, `the name is ${values.name}`);
    expect(values.open === "2026-12-7-0-0", `opens ${values.open}`);
    expect(values.close === "2026-12-10-23-59", `closes ${values.close}`);
    await shePresses("Tekan Simpan dan tampilkan, Bu.", save, "3-simpan-dan-tampilkan.png");
    await page.waitForURL(/\/mod\/quiz\/view\.php/u, { timeout: 20_000 });
  },
);

await check(
  "Spike: Nemu drops the XML on Bank soal › Impor's picker; she presses Impor",
  async () => {
    await page.waitForURL(/\/question\/bank\/importquestions\/import\.php/u, { timeout: 60_000 });
    const impor = page.getByRole("button", { name: "Impor", exact: true });
    await display("tunjuk")
      .getByText("Tekan Impor, Bu.", { exact: false })
      .waitFor({ timeout: 90_000 });
    const picked = await page.locator(".filepicker-filelist .filepicker-filename").innerText();
    console.log(`  Picker holds: ${picked.trim()}`);
    expect(picked.includes(`${QUIZ}.xml`), "the XML isn't in the picker");
    expect(await page.locator("#id_format_xml").isChecked(), "Format XML Moodle isn't picked");
    await shePresses("Tekan Impor, Bu.", impor, "4-impor.png");
    await page.getByText("Mengimpor 10 soal dari berkas").waitFor({ timeout: 30_000 });
  },
);

await check(
  "Soal › Tambah › dari bank soal, all ticked; she presses Tambahkan soal terpilih",
  async () => {
    const add = page.getByRole("button", { name: "Tambahkan soal terpilih pada kuis" });
    await display("tunjuk")
      .getByText("Tekan Tambahkan soal terpilih pada kuis, Bu.", { exact: false })
      .waitFor({ timeout: 90_000 });
    const ticked = await page
      .locator(".modal.show input[name^='q'][type=checkbox]:checked")
      .count();
    console.log(`  Ticked in the bank: ${ticked}`);
    await shePresses("Tekan Tambahkan soal terpilih pada kuis, Bu.", add, "5-tambahkan.png");
    await page.waitForURL(/\/mod\/quiz\/edit\.php/u, { timeout: 30_000 });
    await page.locator("li.slot").first().waitFor({ timeout: 30_000 });
    const listed = await page.locator("li.slot").count();
    expect(listed === 10, `Soal lists ${listed} questions`);
  },
);

const RECIPE = [
  "Naskah diubah jadi soal Moodle",
  "Buat kuis di bagian IPAS",
  "Atur waktu buka dan tutup",
  "Ibu tekan Simpan dan tampilkan",
  "Bank soal › Impor",
  "Soal › Tambah › dari bank soal",
];
await check("The F4-1 check runs on the new quiz and ends on one Sudah dicek card", async () => {
  const preview = page.getByRole("button", {
    name: /^(Pratinjau kuis|Lanjutkan pratinjau terakhir)$/u,
  });
  await shePresses("Pratinjau kuis", preview, "6-pratinjau.png");
  await page.waitForURL(/\/mod\/quiz\/attempt\.php/u, { timeout: 20_000 });
  // F4·11: Sudah dicek, the title, what the check confirmed, then Cara pasang kuis.
  const card = display("info");
  await card
    .getByText("Kuis terpasang, 10 soal siap.", { exact: true })
    .waitFor({ timeout: 60_000 });
  await card.getByText("Sudah dicek").waitFor();
  await card.getByText("Gambar dan kunci semua soal lengkap.", { exact: true }).waitFor();
  await card.getByText("Catatan langkah · Cara pasang kuis").waitFor();
  const steps = await card.getByRole("listitem").allTextContents();
  const want = RECIPE.map((step, index) => `${index + 1}${step}`);
  expect(steps.join("|") === want.join("|"), `the recipe is ${JSON.stringify(steps)}`);
  await card.getByRole("button", { name: "Coba sendiri" }).waitFor();
  await page.screenshot({ path: join(shots, "7-siap.png") });
  await card.getByRole("button", { name: "Tutup" }).click();
  // Reopened from the Nemu button it is the recipe itself, still with Coba sendiri.
  // F1·12a: the Nemu button asks what to open; Catatan langkah counts the kept notes.
  await overlay.locator("button[aria-label='Tanya Nemu']").click();
  await overlay.getByText("Mau buka apa, Bu?").waitFor();
  await overlay.getByRole("button", { name: /^Catatan langkah · \d+ tersimpan$/u }).click();
  const notes = overlay.getByRole("region", { name: "Cara pasang kuis" });
  await notes.getByText(`Disimpan dari pemasangan ${QUIZ}`, { exact: false }).waitFor();
  await notes.getByRole("button", { name: "Coba sendiri" }).waitFor();
  await page.screenshot({ path: join(shots, "8-catatan-langkah.png") });
  await notes.getByRole("button", { name: "Tutup" }).click();
  console.log(`  Pages opened: ${[...new Set(visited)].join(" → ")}`);
});
// --- The Moodle database against Richard's expected XML ----------------------------------------

/** A PNG's pixels, filters undone, so pictures compare whatever wrote them. */
function pngPixels(bytes) {
  let width = 0;
  let height = 0;
  let type = 0;
  const idat = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const name = bytes.toString("latin1", at + 4, at + 8);
    if (name === "IHDR") {
      width = bytes.readUInt32BE(at + 8);
      height = bytes.readUInt32BE(at + 12);
      type = bytes[at + 17];
    }
    if (name === "IDAT") idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 1;
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      out[y * stride + x] = (value + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff;
    }
  }
  return `${width}x${height}:${out.toString("base64")}`;
}

const words = (html) =>
  html
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function expectedQuestions() {
  const xml = readFileSync(join(pack, "F4-2_hasil-yang-diharapkan.xml"), "utf8");
  return [...xml.matchAll(/<question type="multichoice">([\s\S]*?)<\/question>/gu)].map(
    ([, body]) => ({
      name: body.match(/<name><text>([^<]*)<\/text><\/name>/u)[1],
      text: words(body.match(/<questiontext[^>]*>\s*<text><!\[CDATA\[([\s\S]*?)\]\]>/u)[1]),
      answers: [...body.matchAll(/<answer fraction="([\d.]+)"[^>]*>([\s\S]*?)<\/answer>/gu)].map(
        ([, fraction, answer]) => {
          const file = answer.match(/encoding="base64">([^<]+)</u)?.[1];
          return {
            fraction: Number(fraction),
            text: words(answer.match(/<text><!\[CDATA\[([\s\S]*?)\]\]>/u)?.[1] ?? ""),
            pixels: file ? pngPixels(Buffer.from(file, "base64")) : null,
          };
        },
      ),
    }),
  );
}

await check(
  "F4-2: 10/10 questions match the expected XML; opens Mon 7 Dec, closes Thu 10 Dec 2026",
  async () => {
    if (!local) return console.log("  (database not reachable: compare the quiz by hand)");
    const [quiz] =
      sql(`SELECT q.id, q.timeopen, q.timeclose, cs.name FROM mdl_quiz q
      JOIN mdl_course c ON c.id = q.course
      JOIN mdl_course_modules cm ON cm.instance = q.id AND cm.module = (SELECT id FROM mdl_modules WHERE name = 'quiz')
      JOIN mdl_course_sections cs ON cs.id = cm.section
     WHERE c.shortname = '4A-UJI' AND q.name = '${QUIZ}' ORDER BY q.id DESC LIMIT 1`) ?? [];
    expect(quiz, "the quiz isn't in 4A-UJI");
    const [id, timeopen, timeclose, section] = quiz;
    const at = (unix) =>
      new Date(Number(unix) * 1000).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    console.log(`  ${QUIZ} in ${section}: opens ${at(timeopen)}, closes ${at(timeclose)}`);
    expect(section === "IPAS", `the quiz is in section ${section}`);
    expect(
      Number(timeopen) === Date.UTC(2026, 11, 6, 17, 0) / 1000,
      "it doesn't open Mon 7 Dec 00.00 WIB",
    );
    expect(
      Number(timeclose) === Date.UTC(2026, 11, 10, 16, 59) / 1000,
      "it doesn't close Thu 10 Dec 23.59 WIB",
    );

    const slots = sql(`SELECT s.slot, qn.id, qn.name, qn.questiontext, ctx.id FROM mdl_quiz_slots s
      JOIN mdl_question_references r ON r.itemid = s.id AND r.component = 'mod_quiz' AND r.questionarea = 'slot'
      JOIN mdl_question_versions v ON v.questionbankentryid = r.questionbankentryid
      JOIN mdl_question qn ON qn.id = v.questionid
      JOIN mdl_question_bank_entries e ON e.id = r.questionbankentryid
      JOIN mdl_question_categories qc ON qc.id = e.questioncategoryid
      JOIN mdl_context ctx ON ctx.id = qc.contextid
     WHERE s.quizid = ${id} ORDER BY s.slot, v.version DESC`);
    const answers = sql(`SELECT a.question, a.id, a.fraction, a.answer FROM mdl_question_answers a
     WHERE a.question IN (${slots.map((row) => row[1]).join(",") || 0}) ORDER BY a.question, a.id`);
    const files = sql(`SELECT f.itemid, f.contenthash FROM mdl_files f
     WHERE f.component = 'question' AND f.filearea = 'answer' AND f.filename <> '.'
       AND f.itemid IN (${answers.map((row) => row[1]).join(",") || 0})`);
    const picture = (answerId) => {
      const hash = files.find((row) => row[0] === answerId)?.[1];
      if (!hash) return null;
      const bytes = compose([
        "exec",
        "-T",
        "moodle",
        "cat",
        `/var/www/moodledata/filedir/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`,
      ]);
      return bytes ? pngPixels(bytes) : "unreadable";
    };
    const seen = new Set();
    const ours = slots
      .filter(([slot]) => !seen.has(slot) && seen.add(slot))
      .map(([, qid, name, text]) => ({
        name,
        text: words(text),
        answers: answers
          .filter((row) => row[0] === qid)
          .map(([, answerId, fraction, answer]) => ({
            fraction: Math.round(Number(fraction) * 100),
            text: words(answer),
            pixels: picture(answerId),
          })),
      }));
    const expected = expectedQuestions();
    let matched = 0;
    for (const [index, question] of expected.entries()) {
      const same = JSON.stringify(ours[index]) === JSON.stringify(question);
      if (same) matched += 1;
      else console.log(`  ${question.name} differs: ${JSON.stringify(ours[index])?.slice(0, 200)}`);
    }
    console.log(`  ${matched}/${expected.length} questions match F4-2_hasil-yang-diharapkan.xml`);
    expect(matched === 10 && ours.length === 10, `${matched}/10 match, ${ours.length} in the quiz`);
  },
);

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
