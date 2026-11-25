// Nemu v2.2 school evaluation (AI_TECHNICAL_PRD §12, spike S1).
//
//   pnpm --filter @nemu/ai eval:school                       offline: the synthetic F1-1 page, no credits
//   pnpm --filter @nemu/ai eval:school -- --live --photo F1-1_foto-buku-nilai-4B-UTS-Matematika.jpg \
//        [--truth truth.json] [--roster roster.json] [--assessment UTS] [--audio clip.wav]
//
// --truth: {"10": 71, "21": "S", …} keyed by line (the official answer key, converted once).
// --roster: [{"studentId": "…", "name": "…", "number": 1}, …]; defaults to the synthetic 4B.
// Live mode reads models from apps/server/.env (OPENROUTER_SCHOOL_*), like the server does.
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { buildVerificationPlan } from "../dist/school/grades/verification.js";
import { CLASS_4B } from "../dist/school/fixtures/sdit-nusantara.js";
import { F1_FINAL_VALUES } from "../dist/school/fixtures/f1-photo.js";
import { stripJpegMetadata } from "../dist/school/image.js";
import { imageDataUrl } from "../dist/school/llm.js";
import { createFixtureSchoolAi, createSchoolAi } from "../dist/school/runtime.js";

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

const live = process.argv.includes("--live");
loadServerEnv();

const ai = live
  ? createSchoolAi({
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      zdr: process.env.OPENROUTER_ZDR === "true",
      models: {
        readA: process.env.OPENROUTER_SCHOOL_READ_A_MODEL ?? "google/gemini-4-hydrogen",
        readB: process.env.OPENROUTER_SCHOOL_READ_B_MODEL ?? "openai/gpt-6.1-terra",
        reread: process.env.OPENROUTER_SCHOOL_REREAD_MODEL ?? "google/gemini-4-hydrogen",
        text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
        transcription: process.env.OPENROUTER_STT_MODEL ?? "openai/whisper-large-v3-turbo",
        speech: process.env.OPENROUTER_TTS_MODEL ?? "",
        speechVoice: process.env.OPENROUTER_TTS_VOICE ?? "",
      },
    })
  : createFixtureSchoolAi();

if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}

const roster = option("roster") ? JSON.parse(await readFile(option("roster"), "utf8")) : CLASS_4B;
const truth = option("truth")
  ? JSON.parse(await readFile(option("truth"), "utf8"))
  : live
    ? null
    : Object.fromEntries(F1_FINAL_VALUES.map((value, index) => [String(index + 1), value]));

let image = { type: "image", dataUrl: "data:image/jpeg;base64,AA" };
if (option("photo")) {
  const bytes = stripJpegMetadata(new Uint8Array(await readFile(option("photo"))));
  const mime = extname(option("photo")).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  image = { type: "image", dataUrl: imageDataUrl(bytes, mime) };
} else if (live) {
  console.error("Live mode needs --photo <path>.");
  process.exit(2);
}

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

const plan = buildVerificationPlan(result.reading);
const flagged = new Set(
  plan.questions.filter((question) => question.kind !== "name").map((question) => question.line),
);
const report = {
  mode: live ? "live" : "offline",
  seconds: Math.round(seconds * 10) / 10,
  rows: result.reading.rows.length,
  questions: plan.questions.length,
  byKind: Object.fromEntries(
    ["digit", "name", "absence"].map((kind) => [
      kind,
      plan.questions.filter((question) => question.kind === kind).length,
    ]),
  ),
  accepted: plan.acceptedSentence,
};

if (truth) {
  // Accuracy before the teacher checks: the reader's value (or suggestion) equals the truth.
  // Flag recall: every cell whose value is wrong must be among the questions (target 100%).
  let correct = 0;
  let wrong = 0;
  let wrongFlagged = 0;
  for (const row of result.reading.rows) {
    const expected = truth[String(row.line)];
    if (expected === undefined) continue;
    const cell = row.cells[0];
    const got = cell.status === "value" ? cell.value : cell.status;
    const right =
      typeof expected === "number" ? got === expected : String(got) === String(expected);
    if (right) correct += 1;
    else {
      wrong += 1;
      if (flagged.has(row.line)) wrongFlagged += 1;
    }
  }
  report.cellAccuracyBeforeCheck = `${((correct / (correct + wrong)) * 100).toFixed(1)}%`;
  report.flagRecallOnWrongCells = wrong
    ? `${((wrongFlagged / wrong) * 100).toFixed(0)}%`
    : "n/a (no wrong cells)";
  report.unflaggedWrongLines = result.reading.rows
    .filter((row) => {
      const expected = truth[String(row.line)];
      const cell = row.cells[0];
      const got = cell.status === "value" ? cell.value : cell.status;
      return expected !== undefined && String(got) !== String(expected) && !flagged.has(row.line);
    })
    .map((row) => row.line);
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
