// Nemu school evaluation (AI_TECHNICAL_PRD §13, F1-1).
//
//   pnpm --filter @nemu/ai eval:school                       offline: the fixture reader, no credits
//   pnpm --filter @nemu/ai eval:school -- --live [--photo <jpg>] [--truth <csv|json>] [--roster <csv|json>]
//        [--assessment UTS] [--kkm 75] [--audio clip.wav]
//
// Also reads the photo's heading first (#269): the official page should give UTS · Matematika · 4B.
// Defaults are the official F1-1 files in src/school/fixtures: the photo, F1-1_kunci-jawaban.csv
// and daftar-siswa-4B.csv. --truth also takes {"10": 71, "23": "S", …} keyed by line.
// --roster also takes [{"studentId": "…", "name": "…", "number": 1}, …].
// Live mode reads models from apps/server/.env (OPENROUTER_SCHOOL_*), like the server does.
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { applyAnswers, buildVerificationPlan } from "../dist/school/grades/verification.js";
import { applySchoolRules } from "../dist/school/grades/rules.js";
import { stripJpegMetadata } from "../dist/school/image.js";
import { imageDataUrl } from "../dist/school/llm.js";
import { createFixtureSchoolAi, createSchoolAi } from "../dist/school/runtime.js";

const FIXTURES = new URL("../src/school/fixtures/", import.meta.url);

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadServerEnv() {
  const path = new URL("../../../apps/server/.env", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && !process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/u)) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quoted && char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(cell);
        cell = "";
      } else cell += char;
    }
    cells.push(cell);
    rows.push(cells);
  }
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index]])));
}

async function loadRoster(path) {
  const text = await readFile(path, "utf8");
  if (extname(path) !== ".csv") return JSON.parse(text);
  return parseCsv(text).map((row) => ({
    studentId: row.nisn,
    name: row.nama_lengkap,
    number: Number(row.no_absen),
  }));
}

/** line → { value: number | "S" | "I" | "A", name?: roster name, mustFlag?: boolean } */
async function loadTruth(path) {
  const text = await readFile(path, "utf8");
  if (extname(path) !== ".csv") {
    return Object.fromEntries(
      Object.entries(JSON.parse(text)).map(([line, value]) => [line, { value }]),
    );
  }
  return Object.fromEntries(
    parseCsv(text).map((row) => [
      row.baris_di_buku,
      {
        value: row.nilai_benar
          ? Number(row.nilai_benar)
          : (row.catatan.match(/\b([SIA]) \(/u)?.[1] ?? null),
        name: row.nama_di_alursekolah,
        nameDiffers: row.nama_di_buku !== row.nama_di_alursekolah,
        mustFlag: row.wajib_ditandai_kuning === "ya",
      },
    ]),
  );
}

const live = process.argv.includes("--live");
loadServerEnv();

// Usage per call, from OpenRouter's response (cost in US$ when it reports one).
const usage = [];
const meteredFetch = async (input, init) => {
  const response = await fetch(input, init);
  const copy = response.clone();
  try {
    const body = await copy.json();
    usage.push({
      model: body.model ?? null,
      input: body.usage?.input_tokens ?? 0,
      output: body.usage?.output_tokens ?? 0,
      cost: body.usage?.cost ?? null,
    });
  } catch {
    // Not JSON: nothing to meter.
  }
  return response;
};

const models = {
  readA: process.env.OPENROUTER_SCHOOL_READ_A_MODEL ?? "google/gemini-4-hydrogen",
  readB: process.env.OPENROUTER_SCHOOL_READ_B_MODEL ?? "openai/gpt-6.1-terra",
  reread: process.env.OPENROUTER_SCHOOL_REREAD_MODEL ?? "openai/gpt-6.2-sol",
  text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
  transcription: process.env.OPENROUTER_STT_MODEL ?? "openai/whisper-large-v3-turbo",
  speech: process.env.OPENROUTER_TTS_MODEL ?? "",
  speechVoice: process.env.OPENROUTER_TTS_VOICE ?? "",
};

if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}

const ai = live
  ? createSchoolAi({
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      zdr: process.env.OPENROUTER_ZDR === "true",
      models,
      fetchImplementation: meteredFetch,
    })
  : createFixtureSchoolAi();

const roster = await loadRoster(
  option("roster") ?? new URL("daftar-siswa-4B.csv", FIXTURES).pathname,
);
const truth = await loadTruth(
  option("truth") ?? new URL("F1-1_kunci-jawaban.csv", FIXTURES).pathname,
);
const photoPath = option("photo") ?? new URL("f1-1-buku-nilai-4b.jpg", FIXTURES).pathname;
const kkm = Number(option("kkm") ?? 75);

const bytes = stripJpegMetadata(new Uint8Array(await readFile(photoPath)));
const mime = extname(photoPath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
const image = { type: "image", dataUrl: imageDataUrl(bytes, mime) };

// #269: the heading, read before the full read for "Ini nilai apa, Bu?".
const titleStarted = performance.now();
const titleCandidates = await ai.readPhotoTitle({ image });
const title = {
  candidates: titleCandidates.map((c) => [c.assessment, c.subject, c.className].join(" · ")),
  seconds: Math.round((performance.now() - titleStarted) / 100) / 10,
};

const started = performance.now();
const result = await ai.readGradePhoto({
  image,
  roster,
  assessment: option("assessment") ?? "UTS",
});
const seconds = (performance.now() - started) / 1000;

if (result.status !== "ok") {
  console.log(JSON.stringify({ status: result.status, issues: result.issues, seconds }, null, 2));
  process.exit(1);
}

const { reading } = result;
const plan = buildVerificationPlan(reading);
const asked = (kind) => plan.questions.filter((question) => question.kind === kind);
const cellAsked = new Set(
  plan.questions.filter((question) => question.kind !== "name").map((question) => question.line),
);
const nameAsked = new Set(asked("name").map((question) => question.line));
const report = {
  mode: live ? "live" : "offline",
  models: live ? models : "fixture",
  seconds: Math.round(seconds * 10) / 10,
  rows: reading.rows.length,
  questions: plan.questions.length,
  byKind: Object.fromEntries(
    ["digit", "name", "absence"].map((kind) => [
      kind,
      asked(kind).map((question) => question.line),
    ]),
  ),
  accepted: plan.acceptedSentence,
  title,
};

const studentByName = new Map(roster.map((student) => [student.name, student.studentId]));
const valueOf = (cell) => (cell.status === "value" ? cell.value : cell.status);

// Before the teacher checks: the reader's value (or first suggestion) equals the truth.
let correct = 0;
const wrongLines = [];
const misnamedLines = [];
for (const row of reading.rows) {
  const expected = truth[String(row.line)];
  if (!expected) continue;
  if (String(valueOf(row.cells[0])) === String(expected.value)) correct += 1;
  else wrongLines.push(row.line);
  if (expected.name && row.studentId !== studentByName.get(expected.name))
    misnamedLines.push(row.line);
}
const truthLines = Object.keys(truth).length;
const missingLines = Object.keys(truth)
  .map(Number)
  .filter((line) => !reading.rows.some((row) => row.line === line));
report.cellAccuracyBeforeCheck = `${((correct / truthLines) * 100).toFixed(1)}% (${correct}/${truthLines})`;
// The same per digit, for the numeric cells (an unreadable cell counts all its digits wrong).
let digits = 0;
let digitsRight = 0;
for (const row of reading.rows) {
  const expected = truth[String(row.line)];
  if (typeof expected?.value !== "number") continue;
  const want = String(expected.value);
  const got = String(valueOf(row.cells[0]));
  digits += want.length;
  if (got.length === want.length)
    digitsRight += [...want].filter((digit, index) => got[index] === digit).length;
}
report.digitAccuracyBeforeCheck = `${((digitsRight / digits) * 100).toFixed(1)}% (${digitsRight}/${digits})`;
report.wrongCells = wrongLines.map((line) => {
  const cell = reading.rows.find((row) => row.line === line).cells[0];
  return `${line}: ${valueOf(cell)} (truth ${truth[line].value}; readings ${JSON.stringify(cell.readings)})`;
});
report.flagRecallOnWrongCells = wrongLines.length
  ? `${((wrongLines.filter((line) => cellAsked.has(line)).length / wrongLines.length) * 100).toFixed(0)}%`
  : "n/a (no wrong cells)";
report.unflaggedWrongLines = wrongLines.filter((line) => !cellAsked.has(line));
report.missingLines = missingLines;
report.unaskedWrongNames = misnamedLines.filter((line) => !nameAsked.has(line));

const mustFlag = Object.entries(truth)
  .filter(([, row]) => row.mustFlag)
  .map(([line]) => Number(line));
const nameLines = Object.entries(truth)
  .filter(([, row]) => row.nameDiffers)
  .map(([line]) => Number(line));
const absentLines = Object.entries(truth)
  .filter(([, row]) => typeof row.value === "string")
  .map(([line]) => Number(line));
report.doubtfulFlagged = `${mustFlag.filter((line) => cellAsked.has(line)).length}/${mustFlag.length}`;
report.namesConfirmed = `${nameLines.filter((line) => nameAsked.has(line)).length}/${nameLines.length}`;
report.absenceAsked = `${absentLines.filter((line) => asked("absence").some((q) => q.line === line)).length}/${absentLines.length}`;

// The teacher answers every question from the book; then the school rules run (KKM, S blank).
if (Object.values(truth).every((row) => row.name)) {
  const answers = plan.questions.map((question) => {
    const expected = truth[String(question.line)];
    if (question.kind === "name")
      return { questionId: question.id, answer: studentByName.get(expected?.name) ?? "none" };
    if (typeof expected?.value !== "number")
      return { questionId: question.id, answer: "Kosongkan" };
    return { questionId: question.id, answer: String(expected.value) };
  });
  const applied = applyAnswers(reading, answers);
  if (applied.status !== "ok") report.afterCheck = { unresolved: applied.lines };
  else {
    const ruled = applySchoolRules(
      applied.column,
      applied.entries,
      { kkm },
      {
        "school.kkm": "sop",
        "school.absence_blank": "sop",
      },
    );
    const wanted = new Map(Object.values(truth).map((row) => [row.name, row.value]));
    const wrongSaved = ruled.entries
      .filter((entry) => {
        const expected = wanted.get(entry.name);
        return typeof expected === "number" ? entry.value !== expected : entry.value !== null;
      })
      .map((entry) => `${entry.name}: ${entry.value}`);
    const expectedRemedial = [...wanted.values()].filter(
      (value) => typeof value === "number" && value < kkm,
    ).length;
    report.afterCheck = {
      entries: ruled.entries.length,
      wrongGradesSaved: wrongSaved,
      remedial: `${ruled.summary.remedial} (expected ${expectedRemedial})`,
      blank: ruled.entries.filter((entry) => entry.value === null).map((entry) => entry.name),
    };
  }
}

if (live) {
  const known = usage.filter((call) => call.cost !== null);
  report.calls = usage.length;
  report.tokens = usage.map((call) => `${call.model}: ${call.input} in / ${call.output} out`);
  report.costUsd = known.length
    ? Math.round(known.reduce((sum, call) => sum + call.cost, 0) * 10000) / 10000
    : "not reported";
}

if (option("audio")) {
  const audio = await readFile(option("audio"));
  const format = extname(option("audio")).slice(1);
  const t0 = performance.now();
  const transcript = await ai.transcribe({ base64: audio.toString("base64"), format });
  report.transcript = {
    text: transcript.text,
    seconds: Math.round((performance.now() - t0) / 100) / 10,
  };
}

console.log(JSON.stringify(report, null, 2));
