// F3-1 (#220): the official setoran tahfidz case end to end through the generic BPMN code.
//
//   pnpm --filter @nemu/ai eval:f3-1                          offline (fixture responder), no credits
//   pnpm --filter @nemu/ai eval:f3-1 -- --live [--runs 3] [--readers readA,readB]
//
// Reads the official BPMN, photo and key from src/school/fixtures, plans from the teacher's
// sentence, reads the photo, answers each question the way the test teacher does (Tajwid Citra
// = 87, from F3-1_kunci.csv), and checks the rows against the key and that the plan stops before
// the teacher's button. Then the archived izin BPMN plans through the same code (regression).
// Live mode reads models from apps/server/.env (OPENROUTER_SCHOOL_*), like the server does.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { importBpmn } from "../dist/school/bpmn/graph.js";
import { planBpmnStep } from "../dist/school/bpmn/plan.js";
import { readFormPhoto } from "../dist/school/bpmn/form-photo.js";
import { createOpenRouterJsonCaller, imageDataUrl } from "../dist/school/llm.js";
import { createFixtureSchoolAi, createSchoolAi } from "../dist/school/runtime.js";

const FIXTURES = new URL("../src/school/fixtures/", import.meta.url).pathname;
const TODAY = "2026-12-01";
const TEACHER = ["Guru", "guru"];
const SENTENCE = "Catat setoran hafalan 4A hari ini";
// 01_profil-sekolah/daftar-siswa-4A.csv (synthetic), as WS-06 serves it.
const CLASS_4A = [
  "Aisyah Putri Wijaya",
  "Fatih Rizky Wijaya",
  "Zahra Nur Wijaya",
  "Bagas Pratama",
  "Citra Lestari",
  "Dimas Saputra",
  "Elsa Maharani",
  "Gilang Ramadhan",
  "Hana Safitri",
  "Ilham Nugroho",
].map((name, index) => ({ studentId: `4a-${index + 1}`, name, number: index + 1 }));
// The labels the mock's Setoran baru form shows (05_tiruan-alursekolah, Al-Quran › Tahfidz).
const PAGE_LABELS = ["Kelas", "Tanggal setoran"];
const PAGE_COLUMNS = ["Murid", "Surah", "Dari ayat", "Sampai ayat"];
const PAGE_COLUMNS_SCORES = ["Fashohah", "Tartil", "Tajwid", "Adab", "Catatan"];

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

/** One CSV line; quoted cells may hold commas. */
function csvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

const live = process.argv.includes("--live");
loadServerEnv();
if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}
const models = {
  readA: process.env.OPENROUTER_SCHOOL_READ_A_MODEL ?? "google/gemini-4-hydrogen",
  readB: process.env.OPENROUTER_SCHOOL_READ_B_MODEL ?? "openai/gpt-6.1-terra",
  reread: process.env.OPENROUTER_SCHOOL_REREAD_MODEL ?? "google/gemini-4-hydrogen",
  text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
  transcription: process.env.OPENROUTER_STT_MODEL ?? "openai/whisper-large-v3-turbo",
  speech: "",
  speechVoice: "",
};
const zdr = process.env.OPENROUTER_ZDR === "true";
const ai = live
  ? createSchoolAi({ apiKey: process.env.OPENROUTER_API_KEY, zdr, models })
  : createFixtureSchoolAi();

const [header, ...lines] = readFileSync(join(FIXTURES, "F3-1_kunci.csv"), "utf8")
  .trim()
  .split("\n");
const keys = csvLine(header);
const KUNCI = lines.map((line) => Object.fromEntries(csvLine(line).map((v, i) => [keys[i], v])));
const ASKED = KUNCI.filter((row) => row.sel_yang_harus_ditanyakan !== "-");

const graph = await importBpmn(
  readFileSync(join(FIXTURES, "F3-1_catat-hafalan-tahfidz.bpmn"), "utf8"),
);
let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? "✔" : "✘"} ${text}`);
};

// 1. The sentence → slots → the plan asks for the setoran's data (the photo), steps shown first.
const slots = await ai.extractSlots({
  graph,
  teacherLanes: TEACHER,
  text: SENTENCE,
  today: TODAY,
  known: {},
});
console.log(`slots: ${JSON.stringify(slots)}`);
const first = planBpmnStep({
  graph,
  slots,
  stepIndex: 0,
  honorific: "Bu",
  teacherLanes: TEACHER,
  pages: { Task_Setoran: { page: "Al-Quran › Setoran baru", source: "mapping" } },
});
console.log(`overview:\n  ${first.overview.join("\n  ")}`);
report(
  first.step.kind === "ask" && first.step.taskId === "Task_Setoran",
  `the plan asks for the setoran's data: ${JSON.stringify(first.step)}`,
);

// 2. The photo, read against the task's unknown fields.
const task = graph.nodes[first.step.taskId];
const fields = task.formFields.filter((field) => slots[field.id] == null);
const photo = new Uint8Array(readFileSync(join(FIXTURES, "F3-1_foto-buku-setoran-tahfidz-4A.jpg")));
const image = { type: "image", dataUrl: imageDataUrl(photo, "image/jpeg") };
const COLUMNS = ["surah", "ayat_dari", "ayat_sampai", "fashohah", "tartil", "tajwid", "adab"];

function score(reading) {
  if (reading.status !== "ok") return { cells: 0, right: 0, wrong: ["reshoot"], asked: [] };
  let cells = 0;
  let right = 0;
  const wrong = [];
  for (const want of KUNCI) {
    const row = reading.table.rows.find((item) => item.name === want.murid);
    for (const column of COLUMNS) {
      const isAsked = ASKED.some(
        (item) =>
          item.murid === want.murid &&
          item.sel_yang_harus_ditanyakan.toLowerCase().startsWith(column),
      );
      if (isAsked) continue;
      cells += 1;
      const got = row?.values[column];
      if (got === want[column]) right += 1;
      else wrong.push(`${want.murid} ${column}=${got ?? "∅"} (kunci ${want[column]})`);
    }
  }
  const extra = reading.table.rows.filter((row) => !KUNCI.some((want) => want.murid === row.name));
  for (const row of extra) wrong.push(`extra row ${row.name}`);
  const asked = reading.questions.map((question) => question.prompt);
  return { cells, right, wrong, asked, questions: reading.questions };
}

const runs = Number(option("runs") ?? 1);
const readers = live ? (option("readers") ?? "readA").split(",") : ["fixture"];
let chosen = null;
for (const reader of readers) {
  for (let run = 0; run < runs; run += 1) {
    const reading = live
      ? await readFormPhoto(
          createOpenRouterJsonCaller({
            apiKey: process.env.OPENROUTER_API_KEY,
            model: models[reader],
            zdr,
            reasoningEffort: "low",
          }),
          { image, fields, roster: CLASS_4A, honorific: "Bu" },
        ).catch((error) => ({ status: "error", error }))
      : await ai.readFormPhoto({ image, fields, roster: CLASS_4A, honorific: "Bu" });
    if (reading.status === "error") {
      report(false, `${reader} run ${run + 1}: ${reading.error.message.slice(0, 200)}`);
      continue;
    }
    const result = score(reading);
    const tajwidAsked = result.asked.some((prompt) => /Tajwid Citra Lestari/u.test(prompt));
    report(
      result.right === result.cells && tajwidAsked && result.asked.length === ASKED.length,
      `${live ? models[reader] : "fixture"} run ${run + 1}: ${result.right}/${result.cells} cells match the kunci; asked: ${result.asked.join(" | ") || "nothing"}${result.wrong.length ? `; wrong: ${result.wrong.join(", ")}` : ""}`,
    );
    if (reading.status === "ok") {
      const citra = reading.table.rows.find((row) => row.name === "Citra Lestari");
      if (citra?.values.tajwid) report(false, `Tajwid Citra was guessed: ${citra.values.tajwid}`);
      chosen ??= reading;
    }
  }
}

// 3. The teacher answers the questions as in the test; the rows step and the stop before Simpan.
if (chosen) {
  const answers = { tajwid: ASKED[0]?.tajwid };
  const table = {
    ...chosen.table,
    rows: chosen.table.rows.map((row) => {
      const question = chosen.questions.find(
        (item) => item.kind === "value" && item.rowName === row.name,
      );
      return question
        ? { ...row, values: { ...row.values, [question.fieldId]: answers[question.fieldId] } }
        : row;
    }),
  };
  const plan = planBpmnStep({
    graph,
    slots,
    table,
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
    pages: { Task_Setoran: { page: "Al-Quran › Setoran baru", source: "mapping" } },
  });
  const rows = plan.steps.find((step) => step.kind === "rows");
  const matched = KUNCI.filter((want) => {
    const row = rows?.rows.find((item) => item.name === want.murid);
    return row && COLUMNS.every((column) => row.values[column] === want[column]);
  }).length;
  report(matched === KUNCI.length, `${matched}/${KUNCI.length} rows match F3-1_kunci.csv`);
  const human = plan.steps.findLast((step) => step.kind === "human");
  report(
    human?.action === "Simpan setoran",
    `the plan stops before ${human?.action}: ${plan.steps.map((step) => step.kind).join(" → ")}`,
  );
  console.log(`announcements: ${plan.announcements.join(" | ")}`);
}

// 4. Field labels → page labels (code first, the text model for the rest).
const allFields = graph.nodes.Task_Setoran.formFields.map(({ id, label }) => ({ id, label }));
const matches = await ai.matchFields({
  fields: [...graph.nodes.Task_PilihJenis.formFields, ...allFields].map(({ id, label }) => ({
    id,
    label,
  })),
  pageLabels: [...PAGE_LABELS, ...PAGE_COLUMNS, ...PAGE_COLUMNS_SCORES],
});
console.log(`labels: ${JSON.stringify(matches)}`);
report(
  allFields.every((field) => matches[field.id] === field.label),
  "every setoran field finds its page label",
);

// 5. Regression: the archived izin BPMN (v2.2) through the same code path.
const izin = await importBpmn(
  readFileSync(join(FIXTURES, "F3-1_pengajuan-izin-guru.bpmn"), "utf8"),
);
const izinSlots = await ai.extractSlots({
  graph: izin,
  teacherLanes: TEACHER,
  text: "Saya izin hari Kamis, anak saya sakit",
  today: TODAY,
  known: {},
});
const izinPlan = planBpmnStep({
  graph: izin,
  slots: { ...izinSlots, alasan: "Mengantar anak ke dokter" },
  stepIndex: 0,
  honorific: "Bu",
  teacherLanes: TEACHER,
});
console.log(`izin slots: ${JSON.stringify(izinSlots)}`);
report(
  izinSlots.jenis_izin === "keperluan_keluarga" && izinSlots.tanggal_mulai === "2026-12-03",
  "izin: 'anak saya sakit' is keperluan keluarga on Kamis 3 Desember",
);
report(
  izinPlan.steps.at(-2)?.kind === "human" && izinPlan.steps.at(-1)?.kind === "done",
  `izin: ${izinPlan.steps.map((step) => step.kind).join(" → ")}; ${izinPlan.announcements.join(" | ")}`,
);

process.exit(failed ? 1 : 0);
