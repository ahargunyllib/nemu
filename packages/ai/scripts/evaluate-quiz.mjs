// F4-2 (#219): the teacher's script read into Moodle XML, compared with the expected file.
//
//   pnpm --filter @nemu/ai eval:quiz                    offline: the fixture reading, no credits
//   pnpm --filter @nemu/ai eval:quiz -- --live [--model google/gemini-3.7-flash] [--runs 3]
//        [--script path.pdf]
//
// Live mode reads the key and OPENROUTER_SCHOOL_SCRIPT_MODEL from apps/server/.env, like the
// server does. It prints per-question matches against infra/setup/f4-2, never the key.
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { quizScriptResultSchema } from "@nemu/contracts/quiz";

import { bytesToBase64 } from "../dist/school/llm.js";
import { applyQuizAnswers, moodleXml } from "../dist/school/quiz/moodle-xml.js";
import { createFixtureSchoolAi, createSchoolAi } from "../dist/school/runtime.js";

const PACK = new URL("../../../infra/setup/f4-2/", import.meta.url);

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
if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}

const scriptModel =
  option("model") ?? process.env.OPENROUTER_SCHOOL_SCRIPT_MODEL ?? "anthropic/claude-haiku-5.5";
const ai = live
  ? createSchoolAi({
      apiKey: process.env.OPENROUTER_API_KEY,
      zdr: process.env.OPENROUTER_ZDR === "true",
      models: {
        readA: "unused",
        readB: "unused",
        reread: "unused",
        script: scriptModel,
        text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
        transcription: "unused",
        speech: "",
        speechVoice: "",
      },
    })
  : createFixtureSchoolAi();

const words = (html) =>
  html
    .replace(/<[^>]+>/gu, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Each multichoice question: name, words, and per answer its words, fraction and picture count. */
function parseQuestions(xml) {
  return [...xml.matchAll(/<question type="multichoice">([\s\S]*?)<\/question>/gu)].map(
    ([, body]) => ({
      name: body.match(/<name><text>([^<]*)<\/text><\/name>/u)[1],
      text: words(body.match(/<questiontext[^>]*>\s*<text><!\[CDATA\[([\s\S]*?)\]\]>/u)[1]),
      answers: [...body.matchAll(/<answer fraction="([\d.]+)"[^>]*>([\s\S]*?)<\/answer>/gu)].map(
        ([, fraction, answer]) => ({
          fraction: Number(fraction),
          text: words(answer.match(/<text><!\[CDATA\[([\s\S]*?)\]\]>/u)?.[1] ?? ""),
          pictures: (answer.match(/encoding="base64"/gu) ?? []).length,
        }),
      ),
    }),
  );
}

const scriptPath = option("script") ?? new URL("F4-2_naskah-ipas-10-soal.pdf", PACK).pathname;
const extension = extname(scriptPath).toLowerCase();
const mimeType =
  extension === ".pdf"
    ? "application/pdf"
    : extension === ".docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : extension === ".png"
        ? "image/png"
        : "image/jpeg";
const bytes = new Uint8Array(await readFile(scriptPath));
const input = {
  file: {
    name: basename(scriptPath),
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
  },
  utterance:
    "Nemu, masukkan kuis dari naskah ini ke Moodle. Buka Senin 30 November, tutup Kamis 3 Desember.",
  today: "2026-11-27",
  course: "4A-UJI · Kelas 4A (uji)",
  sections: ["Umum", "IPAS", "Bahasa Inggris"],
};

const expected = parseQuestions(
  await readFile(new URL("F4-2_hasil-yang-diharapkan.xml", PACK), "utf8"),
);
const runs = Number(option("runs") ?? 1);
console.log(
  `${live ? `live ${scriptModel}` : "fixture"} · ${basename(scriptPath)} · ${runs} run(s)`,
);

let perfect = 0;
for (let run = 1; run <= runs; run += 1) {
  const started = performance.now();
  const result = quizScriptResultSchema.parse(await ai.readQuizScript(input));
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (result.status !== "ok") {
    console.log(`run ${run}: ${result.status} (${result.message}) in ${seconds}s`);
    continue;
  }
  const asks = result.questions.map((question) => question.id);
  // Asks are answered as "skip" only to build XML for comparison; a real run asks the teacher.
  const ours = asks.length
    ? []
    : parseQuestions(moodleXml(applyQuizAnswers(result.draft, [], []).draft));
  let matched = 0;
  const misses = [];
  for (const question of expected) {
    const mine = ours.find((own) => own.name === question.name);
    if (JSON.stringify(mine) === JSON.stringify(question)) matched += 1;
    else misses.push(question.name);
  }
  if (matched === expected.length) perfect += 1;
  const draft = result.draft;
  console.log(
    `run ${run}: ${matched}/${expected.length} match in ${seconds}s · ${draft.name} · ${draft.section} · ` +
      `${draft.opens?.date}→${draft.closes?.date} · asks: ${asks.join(", ") || "none"}` +
      (misses.length ? ` · differs: ${misses.join(", ")}` : ""),
  );
  if (misses.length && process.argv.includes("--verbose"))
    for (const name of misses)
      console.log(
        JSON.stringify(expected.find((question) => question.name === name)),
        "\n",
        JSON.stringify(ours.find((question) => question.name === name) ?? null),
      );
}
console.log(`${perfect}/${runs} run(s) with ${expected.length}/${expected.length}`);
process.exit(perfect === runs ? 0 : 1);
