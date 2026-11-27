// F0-2 voice commands (07_F0_fondasi/F0-2_perintah-suara.csv): transcription + routing, X/10.
//
//   pnpm --filter @nemu/ai eval:f0-2                          offline: the 10 sentences as text, no credits
//   pnpm --filter @nemu/ai eval:f0-2 -- --audio <folder> [--models microsoft/mai-transcribe-2,openai/whisper-large-v3-turbo]
//
// <folder> holds one recording per sentence, named by its number: 01.m4a … 10.m4a (or 1.wav, …),
// like F0-2_rekaman/ in F0-2_petunjuk-perekaman.md. Each is sent the way the extension sends it,
// 16 kHz mono WAV (converted with ffmpeg when it is installed), to each model through the same
// transcriber the server uses; the transcript is then routed as the extension does. Live mode
// reads OPENROUTER_API_KEY and OPENROUTER_STT_MODEL from apps/server/.env, like the server does.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import {
  commandIntent,
  F0_2_COMMANDS,
  intentMatches,
} from "../dist/school/fixtures/f0-2-commands.js";
import { createOpenRouterTranscriber } from "../dist/school/speech.js";

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

function describe(intent) {
  return Object.entries(intent)
    .map(([key, value]) => (key === "intent" ? value : `${key}=${value}`))
    .join(" ");
}

function report(label, rows) {
  console.log(`\n${label}`);
  for (const row of rows) {
    console.log(`${row.ok ? "✓" : "✗"} ${String(row.no).padStart(2)}  ${row.text}`);
    if (!row.ok) console.log(`       got ${describe(row.actual)}; want ${describe(row.expected)}`);
  }
  const correct = rows.filter((row) => row.ok).length;
  console.log(`${label}: ${correct}/${F0_2_COMMANDS.length} intents correct (F0-2 passes at 8)`);
  return correct;
}

function route(no, text) {
  const { expected } = F0_2_COMMANDS.find((command) => command.no === no);
  const actual = commandIntent(text);
  return { no, text, actual, expected, ok: intentMatches(actual, expected) };
}

const folder = option("audio");
if (!folder) {
  const correct = report(
    "Text (no recognizer)",
    F0_2_COMMANDS.map(({ no, sentence }) => route(no, sentence)),
  );
  process.exit(correct >= 8 ? 0 : 1);
}

loadServerEnv();
if (!process.env.OPENROUTER_API_KEY) {
  console.error("--audio needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}
const models = (
  option("models") ??
  process.env.OPENROUTER_STT_MODEL ??
  "microsoft/mai-transcribe-2"
).split(",");

const FORMATS = new Set(["wav", "webm", "ogg", "mp3", "m4a", "flac"]);
const recordings = new Map();
for (const name of readdirSync(folder)) {
  const no = Number.parseInt(name, 10);
  const format = extname(name).slice(1).toLowerCase();
  if (no >= 1 && no <= 10 && FORMATS.has(format)) recordings.set(no, join(folder, name));
}
if (recordings.size === 0) {
  console.error(`No recordings named 01.wav … 10.m4a in ${folder}.`);
  process.exit(2);
}

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const scratch = await mkdtemp(join(tmpdir(), "nemu-f0-2-"));
async function audioInput(path) {
  if (!ffmpeg) {
    const format = extname(path).slice(1).toLowerCase();
    return { base64: (await readFile(path)).toString("base64"), format };
  }
  const wav = join(scratch, `${Date.now()}-${Math.random()}.wav`);
  const converted = spawnSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    path,
    "-ar",
    "16000",
    "-ac",
    "1",
    wav,
  ]);
  if (converted.status !== 0) throw new Error(`ffmpeg could not read ${path}`);
  return { base64: (await readFile(wav)).toString("base64"), format: "wav" };
}

const scores = [];
try {
  for (const model of models) {
    const transcribe = createOpenRouterTranscriber({
      apiKey: process.env.OPENROUTER_API_KEY,
      model,
      zdr: process.env.OPENROUTER_ZDR === "true",
    });
    const rows = [];
    for (const { no } of F0_2_COMMANDS) {
      const path = recordings.get(no);
      if (!path) {
        rows.push({ ...route(no, ""), text: "(no recording)", ok: false });
        continue;
      }
      const started = performance.now();
      try {
        const audio = await audioInput(path);
        // A busy provider (HTTP 429) is waited out, not scored as a wrong intent.
        let text;
        for (let attempt = 1; text === undefined; attempt += 1) {
          try {
            ({ text } = await transcribe(audio));
          } catch (error) {
            if (attempt >= 4 || !/HTTP 429/u.test(error.message)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 4_000 * attempt));
          }
        }
        const row = route(no, text);
        rows.push({ ...row, text: `${text}  (${Math.round(performance.now() - started)} ms)` });
      } catch (error) {
        rows.push({
          ...route(no, ""),
          text: `(failed: ${error.message.slice(0, 120)})`,
          ok: false,
        });
      }
    }
    scores.push([model, report(model, rows)]);
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

if (scores.length > 1) {
  console.log("\nSummary");
  for (const [model, correct] of scores) console.log(`${correct}/10  ${model}`);
}
process.exit(scores.every(([, correct]) => correct >= 8) ? 0 : 1);
