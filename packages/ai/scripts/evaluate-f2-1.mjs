// F2-1 "nilai tidak muncul" on the official SPP BPMN (AI_TECHNICAL_PRD §5.2, §13): index the file
// (F3-11), then ask the three questions of F2-1_pertanyaan-dan-kunci.csv and check each answer
// against its pass criteria. The AlurSekolah check (F3-13) is given as the CSV describes it: Q1's
// grade is saved; Q2 and Q3 name no student.
//
//   pnpm --filter @nemu/ai eval:f2-1            offline: the fixture responder, no credits
//   pnpm --filter @nemu/ai eval:f2-1 -- --live  the text model from apps/server/.env
import { existsSync, readFileSync } from "node:fs";

import { importBpmn } from "../dist/school/bpmn/graph.js";
import { BU_SITI } from "../dist/school/fixtures/sdit-nusantara.js";
import { isParentSafe } from "../dist/school/process-help.js";
import { createFixtureSchoolAi, createSchoolAi } from "../dist/school/runtime.js";

const FIXTURES = new URL("../src/school/fixtures/", import.meta.url);

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
  const rows = text
    .trim()
    .split("\n")
    .map((line) => {
      const cells = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (quoted && char === '"' && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) {
          cells.push(cell);
          cell = "";
        } else cell += char;
      }
      return [...cells, cell.replace(/\r$/u, "")];
    });
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

const live = process.argv.includes("--live");
loadServerEnv();
if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}

let calls = 0;
// The model's own phrasing, to show what the code's guardrails replaced.
let lastPhrasing = null;
const counted = async (input, init) => {
  calls++;
  const response = await fetch(input, init);
  if (JSON.parse(init.body).text?.format?.name === "process_help") {
    const body = await response.clone().json();
    const text = body.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text")?.text;
    try {
      lastPhrasing = text ? JSON.parse(text) : null;
    } catch {
      console.log(`  (the model's phrasing was cut off: ${body.incomplete_details?.reason})`);
    }
  }
  return response;
};
const ai = live
  ? createSchoolAi({
      apiKey: process.env.OPENROUTER_API_KEY,
      zdr: process.env.OPENROUTER_ZDR === "true",
      fetchImplementation: counted,
      models: {
        readA: "",
        readB: "",
        reread: "",
        text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
        transcription: "",
        speech: "",
        speechVoice: "",
      },
    })
  : createFixtureSchoolAi();

// From the CSV's `lulus_jika`: what Sumber must point at, and what the answer must say. The
// answer is the sentence, its detail line and Kenapa?: about one pupil the bubble says only
// "Kemungkinan karena alur SPP sekolah." (P0-1), her saved grade is the detail, and the cause and
// Bu Ratna are in Kenapa?.
const EXPECTED = {
  1: {
    cause: ["Task_LockGrades", "End_GradesLocked"],
    cite: [["Task_LockGrades", "Timer_DueDateReached"]],
    gradeCheck: { status: "saved", student: "Aisyah Putri Wijaya", assessment: "UTS" },
    sentence: [/^Bukan kesalahan Ibu\. Kemungkinan karena alur SPP sekolah\.$/u],
    detail: [/^Nilai UTS Aisyah sudah tersimpan\.$/u],
    why: [/jatuh tempo/iu, /reguler|bulanan/iu, /Bu Ratna/u],
  },
  2: {
    cause: ["Task_UpdatePartiallyPaid", "End_InvoicesPartiallyPaid"],
    cite: [["Flow_10", "Task_UpdatePartiallyPaid"], ["Task_UnlockGrades"]],
    gradeCheck: { status: "not_asked" },
    sentence: [/sebagian/iu, /jatuh tempo/iu],
  },
  3: {
    cause: ["Task_UnlockGrades"],
    cite: [["Boundary_PaidInCash"], ["Task_UnlockGrades"]],
    gradeCheck: { status: "not_asked" },
    sentence: [/tunai/iu, /jatuh tempo/iu],
  },
};

const xml = readFileSync(new URL("F2-1_alur-spp.bpmn", FIXTURES), "utf8");
const rows = parseCsv(readFileSync(new URL("F2-1_pertanyaan-dan-kunci.csv", FIXTURES), "utf8"));
const graph = await importBpmn(xml);

const started = performance.now();
const index = await ai.suggestSymptoms({ graph });
console.log(`F3-11 index (${Math.round(performance.now() - started)} ms):`);
for (const [id, entry] of Object.entries(index))
  console.log(
    `  ${id}: ${JSON.stringify(entry.symptoms)} way_back=${entry.wayBack} role=${entry.role}`,
  );
const candidates = Object.entries(index).flatMap(([elementId, entry]) =>
  entry.symptoms.map((symptom) => ({ documentId: "doc-spp", elementId, symptom })),
);

let passed = 0;
for (const row of rows) {
  const expected = EXPECTED[row.no];
  const problems = [];
  const t0 = performance.now();
  const found = await ai.matchSymptom({ question: row.pertanyaan_guru, candidates });
  const answer = found
    ? await ai.explainProcess({
        question: row.pertanyaan_guru,
        process: { documentId: "doc-spp", title: "Alur SPP", version: "1", graph, index },
        match: found.match,
        via: found.via,
        gradeCheck: expected.gradeCheck,
        teacher: BU_SITI,
      })
    : null;
  const ms = Math.round(performance.now() - t0);
  if (!found) problems.push("no symptom matched");
  else if (!expected.cause.includes(found.match.elementId))
    problems.push(`matched ${found.match.elementId}`);
  if (answer?.status !== "process") problems.push(`status ${answer?.status ?? "null"}`);
  else {
    const cited = answer.steps.flatMap((step) => step.elementIds);
    for (const anyOf of expected.cite)
      if (!anyOf.some((id) => cited.includes(id)))
        problems.push(`Sumber misses ${anyOf.join("|")}`);
    for (const id of cited)
      if (!(id in graph.nodes) && !(id in graph.flows)) problems.push(`unknown id ${id}`);
    if (answer.fixer?.name !== "Bu Ratna") problems.push(`fixer ${answer.fixer?.name}`);
    for (const pattern of expected.sentence)
      if (!pattern.test(answer.sentence)) problems.push(`sentence lacks ${pattern}`);
    for (const pattern of expected.detail ?? [])
      if (!pattern.test(answer.detail ?? "")) problems.push(`detail lacks ${pattern}`);
    for (const pattern of expected.why ?? [])
      if (!pattern.test(answer.why)) problems.push(`Kenapa? lacks ${pattern}`);
    if (/\bsalah\b/iu.test(answer.sentence)) problems.push("sentence says salah");
    if (!answer.parentReply || !isParentSafe(answer.parentReply)) problems.push("unsafe reply");
    if (!/Bu Ratna/u.test(answer.parentReply ?? "")) problems.push("reply lacks Bu Ratna");
    if (/\b\d+\s*hari\b/iu.test(`${answer.sentence} ${answer.parentReply}`))
      problems.push("promises days");
  }
  const ok = problems.length === 0;
  if (ok) passed++;
  console.log(`\n${ok ? "PASS" : "FAIL"} Q${row.no} (${ms} ms): ${row.pertanyaan_guru}`);
  if (found) console.log(`  match: ${found.match.elementId} via ${found.via?.elementId ?? "-"}`);
  if (answer?.status === "process") {
    console.log(`  sentence: ${answer.sentence}`);
    if (answer.detail) console.log(`  detail: ${answer.detail}`);
    console.log(`  why: ${answer.why}`);
    for (const step of answer.steps)
      console.log(`  - ${step.text} [${step.elementIds.join(", ")}]`);
    console.log(`  reply: ${answer.parentReply}`);
    if (lastPhrasing && lastPhrasing.parent_reply !== answer.parentReply)
      console.log(`  (model reply replaced by the safe draft: ${lastPhrasing.parent_reply})`);
    // About one pupil the bubble leaves the model's answer out (P0-1), so there is nothing to compare.
    if (
      lastPhrasing &&
      !/Kemungkinan karena alur/u.test(answer.sentence) &&
      !answer.sentence.includes(lastPhrasing.answer.trim())
    )
      console.log(`  (model answer replaced by the draft: ${lastPhrasing.answer})`);
  }
  lastPhrasing = null;
  console.log(`  key: ${row.jawaban_inti}`);
  console.log(`  key sources: ${row.elemen_bpmn_sumber}`);
  for (const problem of problems) console.log(`  ✘ ${problem}`);
}

console.log(
  `\nF2-1 ${live ? "live" : "offline"}: ${passed}/${rows.length}${live ? `, ${calls} model calls` : ""}`,
);
process.exit(passed === rows.length ? 0 : 1);
