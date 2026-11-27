// Loads a production build of the extension into Playwright's Chromium and checks F4-3 (#211) end
// to end on the Moodle test site (infra/): on the course page Bu Siti asks "Tolong hapus latihan
// bahasa Inggris yang kemarin." Nemu picks "Latihan: My Family (has/have)" (or asks between it and
// the decoy, on days when the decoy fits "kemarin" as well), opens its Hasil page through the
// menus, and warns on a Kartu Pilih: "Kuis ini sudah dikerjakan 3 siswa. Kalau dihapus, nilainya
// ikut terhapus." with "Jangan hapus" first. Round 1 she keeps it. Round 2 she asks for the button:
// Nemu goes back to the course, switches on Mode Edit, opens the quiz's Edit menu and only points
// at Hapus; she presses it and then cancels Moodle's confirmation. Afterwards the quiz and its 3
// grades are still there, Moodle's log has no deletion, and the Nemu action log (WS-10) has Hapus
// only as a point she pressed herself.
// Needs `NEMU_RESPONDER=fixture pnpm dev` (the Nemu Service and the mock AlurSekolah, where Bu
// Siti's email is read), the Moodle test site with `./setup-4a-uji.sh` run, and that Moodle's host
// as an allowed site; skips with a message when Moodle isn't running. Screenshots:
// .output/verify-f4-3/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, request } from "playwright-core";

const SERVER = process.env.NEMU_SERVER_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_ALURSEKOLAH_URL ?? "http://localhost:3003/";
const MOODLE = process.env.MOODLE_URL ?? "https://localhost/";
const INSTALL_CODE = process.env.NEMU_INSTALL_CODE ?? "NEMU-SDITN-2026";
const QUIZ = "Latihan: My Family (has/have)";
const DECOY = "Parts of Body + Family (pengecoh)";
const WARNING = "Kuis ini sudah dikerjakan 3 siswa. Kalau dihapus, nilainya ikut terhapus.";
const HEADED = process.argv.includes("--headed");

const root = resolve(import.meta.dirname, "..");
const repo = resolve(root, "../..");
const infra = join(repo, "infra");
const extension = join(root, ".output/chrome-mv3");
const shots = join(root, ".output/verify-f4-3");
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
 * The F4-3 quiz in the local Moodle database (infra/compose.yaml): whether it exists, its finished
 * student attempts and grades, and how many activities Moodle's log says were deleted in the
 * course. Null when the database isn't reachable (a remote Moodle).
 */
function moodleState() {
  const sql = `SELECT
      (SELECT count(*) FROM mdl_quiz q
         JOIN mdl_modules m ON m.name = 'quiz'
         JOIN mdl_course_modules cm ON cm.instance = q.id AND cm.module = m.id
        WHERE q.course = c.id AND q.name = '${QUIZ}' AND cm.deletioninprogress = 0),
      (SELECT count(*) FROM mdl_quiz_attempts a JOIN mdl_quiz q ON q.id = a.quiz
        WHERE q.course = c.id AND q.name = '${QUIZ}' AND a.preview = 0 AND a.state = 'finished'),
      (SELECT count(*) FROM mdl_quiz_grades g JOIN mdl_quiz q ON q.id = g.quiz
        WHERE q.course = c.id AND q.name = '${QUIZ}'),
      (SELECT count(*) FROM mdl_logstore_standard_log l
        WHERE l.courseid = c.id AND l.eventname = '\\core\\event\\course_module_deleted')
    FROM mdl_course c WHERE c.shortname = '4A-UJI'`;
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
    const [quizzes, attempts, grades, deletions] = out.split("|").map(Number);
    return Number.isFinite(quizzes) ? { quizzes, attempts, grades, deletions } : null;
  } catch {
    return null;
  }
}

/** The local Nemu Service's D1 file (packages/infra/.alchemy) that holds the WS-10 action log. */
function actionLogDb() {
  const dir = join(repo, "packages/infra/.alchemy/local/d1/cloudflare-runtime-D1DatabaseObject");
  if (!existsSync(dir)) return null;
  for (const file of readdirSync(dir).filter((name) => /^[0-9a-f]{64}\.sqlite$/u.test(name))) {
    try {
      const tables = execFileSync("sqlite3", [join(dir, file), ".tables"], { encoding: "utf8" });
      if (/\baction_log\b/u.test(tables)) return join(dir, file);
    } catch {
      // Not readable here; try the next file.
    }
  }
  return null;
}

/** WS-10 rows written since `since` (ms): what Nemu did, on which target, and how it ended. */
function actionLog(since) {
  const db = actionLogDb();
  if (!db) return null;
  const out = execFileSync(
    "sqlite3",
    [
      "-separator",
      "\t",
      db,
      `SELECT action, target, result, task FROM action_log WHERE acted_at >= ${since} ORDER BY acted_at, rowid`,
    ],
    { encoding: "utf8" },
  ).trim();
  return out
    ? out.split("\n").map((line) => {
        const [action, target, result, task] = line.split("\t");
        return { action, target, result, task };
      })
    : [];
}

const before = moodleState();
console.log(
  before
    ? `  Before: ${before.quizzes} quiz, ${before.attempts} finished attempts, ${before.grades} grades, ${before.deletions} deletions in Moodle's log`
    : "  The Moodle database isn't reachable here, so only the pages are checked.",
);
if (before && (before.quizzes !== 1 || before.attempts !== 3 || before.grades !== 3)) {
  console.log(
    "✘ F4-3 isn't set up: run `./setup-4a-uji.sh` in infra/ (it recreates a deleted quiz).",
  );
  process.exit(1);
}
const startedAt = Date.now();

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

// A fresh sign-in, so Mode Edit is off as a teacher would find it.
await page.goto(new URL("login/logout.php", MOODLE).href);
if (await page.getByRole("button", { name: /^(Keluar|Log out)$/u }).count())
  await page.getByRole("button", { name: /^(Keluar|Log out)$/u }).click();
await page.goto(new URL("login/index.php", MOODLE).href);
if (await page.locator("#username").count()) {
  await page.locator("#username").fill("siti.aminah");
  await page.locator("#password").fill(TEACHER_PASSWORD);
  await page.locator("#loginbtn").click();
  await page.waitForLoadState();
}
const courseUrl = new URL("course/view.php?name=4A-UJI", MOODLE).href;
// Moodle keeps Mode Edit on between sign-ins; she starts with it off, so Nemu switches it on.
await page.goto(courseUrl);
if (await page.locator("body.editing").count()) {
  await page.getByRole("switch", { name: "Mode Edit" }).click();
  await page.waitForURL(courseUrl);
  await page.locator("body:not(.editing)").waitFor();
}

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

async function askNemu(words) {
  const closed = overlay.locator("button[aria-label='Tanya Nemu']");
  await closed.waitFor({ timeout: 15_000 });
  await closed.click();
  await overlay.getByLabel("Pertanyaan untuk Nemu").fill(words);
  await overlay.getByRole("button", { name: "Kirim" }).click();
}

/** Nemu's Kartu Pilih with the warning: the choices in the order shown, and which are risky. */
async function warningCard() {
  const card = display("pilih");
  await card.getByText(WARNING, { exact: true }).waitFor({ timeout: 30_000 });
  const buttons = card.getByRole("button");
  const choices = [];
  for (let index = 0; index < (await buttons.count()); index += 1) {
    const button = buttons.nth(index);
    choices.push({
      text: (await button.textContent()).replace("Berisiko: ", "").trim(),
      risky: (await button.getAttribute("data-risky")) !== null,
    });
  }
  return { card, choices };
}

let pickedBy = "";
await check(
  "Round 1: Bu Siti asks on the course page; Nemu picks My Family and opens Hasil",
  async () => {
    await page.goto(courseUrl);
    visited.length = 0;
    await askNemu("Tolong hapus latihan bahasa Inggris yang kemarin.");
    const which = display("pilih").getByText(/^Kuis yang mana yang mau dihapus/u);
    const results = page.waitForURL(/\/mod\/quiz\/report\.php/u, { timeout: 30_000 });
    const first = await Promise.race([
      which.waitFor({ timeout: 30_000 }).then(() => "asked"),
      page.waitForURL(/\/mod\/quiz\/view\.php/u, { timeout: 30_000 }).then(() => "picked"),
    ]);
    if (first === "asked") {
      // On a day the decoy was open "kemarin" too, Nemu asks; both quizzes are the choices.
      const card = display("pilih");
      expect(await card.getByRole("button", { name: QUIZ }).count(), "My Family isn't a choice");
      expect(await card.getByRole("button", { name: DECOY }).count(), "the decoy isn't a choice");
      await page.screenshot({ path: join(shots, "1-kuis-yang-mana.png") });
      await card.getByRole("button", { name: QUIZ }).click();
    }
    pickedBy =
      first === "asked" ? "asked between My Family and the decoy" : "picked My Family itself";
    await results;
    const opened = [...new Set(visited)];
    expect(
      opened.includes("/mod/quiz/view.php") && opened.at(-1) === "/mod/quiz/report.php",
      `pages opened: ${opened.join(" → ")}`,
    );
    console.log(`  Nemu ${pickedBy}; pages opened: ${opened.join(" → ")}`);
  },
);

await check(
  "The warning: count 3 from Hasil, exact sentence, Jangan hapus first, ⚠ on the second",
  async () => {
    const { choices } = await warningCard();
    await page.waitForTimeout(900);
    const shown = page.locator(".quizattemptcounts").first();
    expect(await ringsOn(shown), "the ring isn't on the count");
    const said = await shown.textContent();
    expect(/\b3\b/u.test(said), `Hasil shows “${said}”`);
    console.log(`  Hasil shows: ${said.trim()}`);
    await page.screenshot({ path: join(shots, "2-peringatan.png") });
    console.log(`  Choices: ${choices.map((c) => `${c.risky ? "⚠ " : ""}${c.text}`).join(" | ")}`);
    expect(choices.length === 2, `${choices.length} choices`);
    expect(choices[0].text === "Jangan hapus" && !choices[0].risky, "Jangan hapus isn't first");
    expect(
      choices[1].text === "Tunjukkan tombol Hapus" && choices[1].risky,
      "the second choice isn't ⚠ Tunjukkan tombol Hapus",
    );
  },
);

await check(
  "Jangan hapus: Catatan langkah, and the quiz and its 3 grades are still there",
  async () => {
    await display("pilih").getByRole("button", { name: "Jangan hapus" }).click();
    const info = display("info");
    await info
      .getByText("Nemu tidak menekan Hapus; Nemu hanya menunjuknya.")
      .waitFor({ timeout: 10_000 });
    await info.getByText("Pilihan: Jangan hapus. Kuis dan nilainya tetap ada.").waitFor();
    await page.screenshot({ path: join(shots, "3-jangan-hapus.png") });
    await page.goto(courseUrl);
    expect(
      (await page.locator("li.modtype_quiz", { hasText: QUIZ }).count()) === 1,
      "the quiz is gone",
    );
    const after = moodleState();
    if (!after) return;
    console.log(
      `  After round 1: ${after.quizzes} quiz, ${after.attempts} finished attempts, ${after.grades} grades`,
    );
    expect(
      after.quizzes === 1 && after.attempts === 3 && after.grades === 3,
      "the quiz or its grades changed",
    );
    expect(after.deletions === before.deletions, "Moodle's log has a deletion");
  },
);

await check(
  "Round 2: Tunjukkan tombol Hapus; Nemu opens Mode Edit and the Edit menu, and only points",
  async () => {
    await page.goto(courseUrl);
    visited.length = 0;
    // Named outright, the quiz needs no question.
    await askNemu("Nemu, hapus kuis Latihan My Family.");
    await page.waitForURL(/\/mod\/quiz\/report\.php/u, { timeout: 30_000 });
    await (
      await warningCard()
    ).card
      .getByRole("button", { name: /Tunjukkan tombol Hapus/u })
      .click();
    await page.waitForURL(/\/course\/view\.php/u, { timeout: 30_000 });
    const sentence = display("tunjuk").getByText("Kalau jadi dihapus, tekan Hapus sendiri, Bu.");
    await sentence.waitFor({ timeout: 40_000 });
    expect(await page.locator("body.editing").count(), "Mode Edit is off");
    const hapus = page
      .locator("li.modtype_quiz", { hasText: QUIZ })
      .locator("[data-action='cmDelete']");
    expect(await hapus.isVisible(), "the quiz's Hapus isn't showing");
    await page.waitForTimeout(900);
    expect(await ringsOn(hapus), "the ring isn't on Hapus");
    await page.screenshot({ path: join(shots, "4-tunjuk-hapus.png") });
    // Nemu waits: nothing was deleted while it points.
    await page.waitForTimeout(2000);
    const waiting = moodleState();
    if (waiting)
      expect(
        waiting.quizzes === 1 && waiting.deletions === before.deletions,
        "deleted while pointing",
      );
    console.log(`  Pages opened: ${[...new Set(visited)].join(" → ")}`);
  },
);

await check(
  "She presses Hapus herself, then cancels Moodle's confirmation: nothing is deleted",
  async () => {
    await page
      .locator("li.modtype_quiz", { hasText: QUIZ })
      .locator("[data-action='cmDelete']")
      .click();
    const confirm = page.getByRole("dialog");
    await confirm.waitFor({ timeout: 10_000 });
    await page.screenshot({ path: join(shots, "5-konfirmasi-moodle.png") });
    await confirm.getByRole("button", { name: /^(Batal|Cancel)$/u }).click();
    const info = display("info");
    await info
      .getByText("Nemu tidak menekan Hapus; Nemu hanya menunjuknya.")
      .waitFor({ timeout: 10_000 });
    await info.getByText(/^(Bu|Ibu|Anda) menekan Hapus/u).waitFor();
    await page.screenshot({ path: join(shots, "6-catatan-langkah.png") });
    const after = moodleState();
    if (!after) return console.log("  (database not reachable: Moodle's log not compared)");
    console.log(
      `  After round 2: ${after.quizzes} quiz, ${after.attempts} finished attempts, ${after.grades} grades, ${after.deletions - before.deletions} new deletions in Moodle's log`,
    );
    expect(
      after.quizzes === 1 && after.attempts === 3 && after.grades === 3,
      "the quiz or its grades changed",
    );
    expect(after.deletions === before.deletions, "Moodle's log has a deletion");
  },
);

await check("WS-10 action log: Hapus appears only as a point the teacher pressed", async () => {
  await page.waitForTimeout(1500);
  const rows = actionLog(startedAt);
  if (!rows)
    return console.log("  (the local Nemu Service database isn't here: action log not read)");
  const hapus = rows.filter((row) => /hapus/iu.test(row.target));
  for (const row of rows.filter((row) => row.action !== "start" && row.action !== "finish"))
    console.log(`  ${row.task} · ${row.action} ${row.target || "—"} → ${row.result}`);
  expect(hapus.length === 1, `${hapus.length} rows name Hapus`);
  expect(
    hapus[0].action === "point" && hapus[0].result === "teacher",
    "Hapus wasn't a point she pressed",
  );
  expect(
    rows.every((row) => ["start", "finish", "point", "clickMenu", "check"].includes(row.action)),
    "Nemu did more than open menus, switch Mode Edit and point",
  );
});

await context.close();
console.log(`Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
