// Loads a production build of the extension into Playwright's Chromium and checks F4-1 (#209) end
// to end on the Moodle test site (infra/): Bu Siti asks "Nemu, tolong cek kuis ini." on the quiz
// page, Nemu opens Setelan, Soal and the quiz page through the menus, points at Pratinjau kuis
// (she presses it), and then points at soal 15 (missing image) and soal 7 (no key, "… Ibu isi
// kuncinya lewat Edit soal. Nemu tidak mengubahnya.", #267), in setup/f4-1/F4-1_kunci.csv's order,
// each under "Memeriksa kuis · 1 dari 2" with Kenapa? and Lanjut, and then says one
// closing sentence ("Selain dua hal itu, kuisnya sudah siap, Bu.", #256). Afterwards the quiz's
// last-modified time and question count are what they were (read from the Moodle database when it
// runs locally).
// Needs `NEMU_RESPONDER=fixture pnpm dev` (the Nemu Service and the mock AlurSekolah, where Bu
// Siti's email is read) and the Moodle test site; skips with a message when Moodle isn't running.
// Screenshots: .output/verify-f4-1/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, request } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const MOODLE = process.env.MOODLE_URL ?? "https://localhost/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const QUIZ = "Kuis IPAS 4A: Energi, Gaya, dan Peta";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const infra = resolve(root, "../../infra");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f4-1");
mkdirSync(shots, { recursive: true });

// Moodle first: without it there is nothing to check.
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

/**
 * The quiz's last-modified time, question count and question versions, read from the local
 * Moodle database (infra/compose.yaml); null when it isn't reachable (a remote Moodle).
 */
function quizState() {
  const sql = `SELECT q.timemodified, (SELECT count(*) FROM mdl_quiz_slots s WHERE s.quizid = q.id),
      (SELECT count(*) FROM mdl_question), (SELECT count(*) FROM mdl_quiz_attempts a WHERE a.quiz = q.id AND a.preview = 0)
    FROM mdl_quiz q JOIN mdl_course c ON c.id = q.course
    WHERE c.shortname = '4A-UJI' AND q.name = '${QUIZ}' ORDER BY q.id DESC LIMIT 1`;
  try {
    const out = execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "moodle",
        "-d",
        "moodle",
        "-At",
        "-c",
        sql,
      ],
      { cwd: infra, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const [timemodified, slots, questions, attempts] = out.split("|").map(Number);
    return Number.isFinite(timemodified) ? { timemodified, slots, questions, attempts } : null;
  } catch {
    return null;
  }
}
const before = quizState();
console.log(
  before
    ? `  Before: timemodified ${before.timemodified}, ${before.slots} questions in the quiz`
    : "  The Moodle database isn't reachable here, so only the Soal page's count is compared.",
);

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
  viewport: { width: 1280, height: 860 },
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
await page.getByRole("link", { name: QUIZ }).first().click();
await page.waitForURL(/\/mod\/quiz\/view\.php/u);
const quizUrl = page.url();

/** Whether Nemu's ring (Sorot arahkan) sits on the element. */
async function ringsOn(locator) {
  const ring = await overlay.locator("[data-nemu-ring]").boundingBox();
  const box = await locator.boundingBox();
  if (!ring || !box) return false;
  const [x, y] = [ring.x + ring.width / 2, ring.y + ring.height / 2];
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

const visited = [];
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
});

await check("Bu Siti asks on the quiz page; Nemu opens Setelan, Soal and Kuis itself", async () => {
  const closed = overlay.locator("button[aria-label='Tanya Nemu']");
  await closed.waitFor({ timeout: 15_000 });
  await closed.click();
  await overlay.getByLabel("Pertanyaan untuk Nemu").fill("Nemu, tolong cek kuis ini.");
  await overlay.getByRole("button", { name: "Kirim" }).click();
  await page.waitForURL(/\/course\/modedit\.php/u, { timeout: 20_000 });
  await page.screenshot({ path: join(shots, "1-setelan.png") });
  await page.waitForURL(/\/mod\/quiz\/edit\.php/u, { timeout: 20_000 });
  await page.waitForURL(/\/mod\/quiz\/view\.php/u, { timeout: 30_000 });
});

await check("Nemu points at Pratinjau kuis, and Bu Siti presses it herself", async () => {
  const sentence = display("tunjuk").getByText("Tekan Pratinjau kuis, Bu.", { exact: false });
  const button = page.getByRole("button", {
    name: /^(Pratinjau kuis|Lanjutkan pratinjau terakhir)$/u,
  });
  await sentence
    .or(display("tunjuk").getByText("Tekan Lanjutkan pratinjau terakhir", { exact: false }))
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  expect(await ringsOn(button), "the ring isn't on the preview button");
  await page.screenshot({ path: join(shots, "2-tunjuk-pratinjau.png") });
  await button.click();
  await page.waitForURL(/\/mod\/quiz\/attempt\.php/u, { timeout: 20_000 });
});

// The official key's kalimat_nemu_yang_diharapkan column, for the rows about one question.
const csvCells = (line) =>
  [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/gu)].map(([, cell]) =>
    cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell,
  );
const [header, ...rows] = readFileSync(join(infra, "setup/f4-1/F4-1_kunci.csv"), "utf8")
  .trim()
  .split("\n")
  .map(csvCells);
const sentenceColumn = header.indexOf("kalimat_nemu_yang_diharapkan");
// PRD v2.3 (#267): a question with no key also says where to fill it, and Nemu proposes no key.
// The updated key file isn't in infra/ yet, so its old no-key sentence gets the new ending here.
const EDIT_SOAL = "Ibu isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.";
const NO_KEY = `Soal 7 belum ada kunci jawabannya, Bu. ${EDIT_SOAL}`;
const kunci = rows
  .map((row) => row[sentenceColumn])
  .filter((text) => /^Soal \d+ /u.test(text))
  .map((text) => (text.endsWith("kunci jawabannya, Bu.") ? `${text} ${EDIT_SOAL}` : text));

await check(
  "F4-1: soal 15 (no image), then soal 7 (no key), one sentence each, pointed at",
  async () => {
    const jawab = display("jawab");
    await jawab.waitFor({ timeout: 30_000 });
    const sentences = [];
    for (let index = 0; index < 10; index += 1) {
      await page.waitForTimeout(900);
      const texts = (await jawab.locator("p").allInnerTexts()).map((text) => text.trim());
      const sentence = texts.find((text) => /, Bu\.$|\.$/u.test(text)) ?? texts.join(" ");
      sentences.push(sentence);
      const slot = Number(sentence.match(/^Soal (\d+)/u)?.[1]);
      if (slot) {
        const onPage = page.locator(`.que[id$='-${slot}']`);
        const target = (await onPage.count()) ? onPage : page.locator(`#quiznavbutton${slot}`);
        expect(await ringsOn(target), `the ring isn't on soal ${slot}`);
      }
      await page.screenshot({ path: join(shots, `3-masalah-${index + 1}.png`) });
      // She opens soal 15 from Navigasi kuis: after the page load Nemu points at the missing image.
      if (slot === 15 && !(await page.locator(".que[id$='-15']").count())) {
        await page.locator("#quiznavbutton15").click();
        await page.waitForURL(/page=14/u, { timeout: 20_000 });
        await jawab
          .getByText("Soal 15 belum ada gambarnya", { exact: false })
          .waitFor({ timeout: 15_000 });
        await page.waitForTimeout(900);
        const image = page.locator(".que[id$='-15'] img[alt='Gambar (3)']");
        expect(
          await ringsOn(image),
          "after the page load the ring isn't on soal 15's missing image",
        );
        await page.screenshot({ path: join(shots, "3-soal-15-gambar.png") });
      }
      if (slot) {
        const header = (await jawab.locator("[data-nemu-status]").innerText()).replace(
          /\s+/gu,
          " ",
        );
        expect(
          header.toLowerCase().includes(`memeriksa kuis · ${index + 1} dari `),
          `the header says “${header}”`,
        );
        expect(await jawab.getByRole("button", { name: "Kenapa?" }).count(), "no Kenapa? link");
      }
      await jawab.getByRole("button", { name: "Lanjut" }).click();
      // After the last problem the closing sentence comes, with Catatan langkah behind it.
      if (await jawab.getByRole("button", { name: "Catatan langkah" }).count()) break;
    }
    console.log(`  Nemu said: ${sentences.join(" | ")}`);
    const order = kunci.map((expected) => sentences.indexOf(expected));
    expect(
      order.every((at, index) => index === 0 || at > (order[index - 1] ?? -1)),
      "the problems aren't in F4-1_kunci.csv's order",
    );
    for (const expected of kunci)
      expect(sentences.includes(expected), `Nemu didn't say “${expected}”`);
    expect(sentences.includes(NO_KEY), `Nemu didn't say “${NO_KEY}”`);
    expect(
      !sentences.some((sentence) => /\?/u.test(sentence)),
      "Nemu asked about a key instead of pointing to Edit soal",
    );
    const closesAt = new Date(2026, 11, 4, 21, 0);
    if (new Date() < closesAt)
      expect(
        sentences.length === kunci.length,
        `${sentences.length - kunci.length} problems more than F4-1 has`,
      );
  },
);

await check(
  "After the last problem Nemu says one closing sentence, about no element (#256)",
  async () => {
    const jawab = display("jawab");
    // The issue's example for the official key's two problems.
    const expected = "Selain dua hal itu, kuisnya sudah siap, Bu.";
    const texts = (await jawab.locator("p").allInnerTexts()).map((text) => text.trim());
    const closing = texts.find((text) => text.startsWith("Selain ")) ?? texts.join(" ");
    console.log(`  Nemu closed with: ${closing}`);
    const closesAt = new Date(2026, 11, 4, 21, 0);
    if (new Date() < closesAt) expect(closing === expected, `Nemu didn't close with “${expected}”`);
    else
      expect(/^Selain .+ hal itu, kuisnya sudah siap, Bu\.$/u.test(closing), "no closing sentence");
    await page.waitForTimeout(900);
    expect(
      !(await overlay.locator("[data-nemu-ring]").count()),
      "the closing sentence still rings an element",
    );
    await page.screenshot({ path: join(shots, "4-penutup.png") });
    await jawab.getByRole("button", { name: "Catatan langkah" }).click();
  },
);

await check("Catatan langkah lists the problems and says nothing was changed", async () => {
  const info = display("info");
  await info.getByText("Nemu tidak mengubah apa pun di kuis ini.").waitFor({ timeout: 10_000 });
  await info.getByText("Masalah: Soal 15 belum ada gambarnya, Bu.").waitFor();
  await page.screenshot({ path: join(shots, "5-catatan-langkah.png") });
  console.log(`  Pages opened: ${[...new Set(visited)].join(" → ")}`);
});

await check("Nothing changed: same question count on Soal, and in the database", async () => {
  await page.goto(quizUrl.replace("view.php?id=", "edit.php?cmid="));
  const listed = await page.locator("li.slot").count();
  expect(listed === 15, `Soal lists ${listed} questions`);
  const after = quizState();
  if (!before || !after)
    return console.log("  (database not reachable: only the Soal page compared)");
  console.log(`  After:  timemodified ${after.timemodified}, ${after.slots} questions in the quiz`);
  expect(after.timemodified === before.timemodified, "the quiz's last-modified time changed");
  expect(after.slots === before.slots && after.slots === 15, "the question count changed");
  expect(after.questions === before.questions, "a question was added or got a new version");
  expect(after.attempts === 0, "a student attempt exists");
});

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
