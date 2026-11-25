import assert from "node:assert/strict";
import test from "node:test";

import type { RecordedEvent } from "@nemu/contracts/school";

import {
  assembleProcedure,
  cleanRecording,
  compileProcedure,
  instantiateProcedure,
} from "./procedures.js";
import { fakeJsonCall } from "./test-helpers.js";

const URL_INPUT = "https://alursekolah.example/nilai/input?kelas=5A";

function event(
  t: number,
  type: RecordedEvent["type"],
  label: string | null,
  value: string | null,
  role: string | null = null,
): RecordedEvent {
  return {
    t,
    type,
    url: URL_INPUT,
    locator: {
      role,
      name: label,
      label,
      placeholder: null,
      css: label ? `[aria-label="${label}"]` : null,
      relX: 0.5,
      relY: 0.5,
    },
    value,
  };
}

/** Pak Rizal recording "input nilai" for 5A Bahasa Indonesia, as in F3-3. */
const RECORDING: RecordedEvent[] = [
  { ...event(0, "navigate", null, null), url: "https://alursekolah.example/nilai/input?kelas=5A" },
  event(1_000, "click", "Kelas", null, "combobox"),
  event(1_400, "change", "Kelas", "5A", "combobox"),
  event(2_000, "change", "Mata pelajaran", "Bahasa Indonesia", "combobox"),
  event(2_600, "change", "Jenis penilaian", "UTS", "combobox"),
  event(3_000, "click", "Tampilkan", null, "button"),
  event(4_000, "click", "Nilai Adi", null, "textbox"),
  event(4_100, "input", "Nilai Adi", "8", "textbox"),
  event(4_200, "input", "Nilai Adi", "80", "textbox"),
  event(5_000, "input", "Catatan", "remedial", "textbox"),
  event(9_000, "click", "Simpan", null, "button"),
];

test("cleaning merges keystrokes, drops focus clicks and keeps selects", () => {
  const steps = cleanRecording(RECORDING);
  assert.deepEqual(
    steps.map((step) => `${step.action}:${step.label}:${step.value ?? ""}`),
    [
      `navigate:https://alursekolah.example/nilai/input?kelas=5A:`,
      "select:Kelas:5A",
      "select:Mata pelajaran:Bahasa Indonesia",
      "select:Jenis penilaian:UTS",
      "click:Tampilkan:",
      "fill:Nilai Adi:80",
      "fill:Catatan:remedial",
      "click:Simpan:",
    ],
  );
  assert.equal(steps[0]?.urlPattern, "https://alursekolah.example/nilai/input");
});

test("demo values become parameters, and Simpan is always the teacher's step", async () => {
  const llm = fakeJsonCall({
    procedure_compile: {
      title: "Input nilai per kelas",
      parameters: [
        { name: "kelas", label: "Kelas", question: "Kelas berapa?", example: "5A" },
        {
          name: "mapel",
          label: "Mata pelajaran",
          question: "Mata pelajarannya apa?",
          example: "Bahasa Indonesia",
        },
        { name: "jenis", label: "Jenis penilaian", question: "Nilai apa?", example: "UTS" },
        { name: "unused", label: "x", question: "x", example: "x" },
      ],
      steps: [
        { index: 1, value_template: "{{kelas}}", instruction: "Pilih kelas di kolom Kelas." },
        { index: 2, value_template: "{{mapel}}", instruction: "Pilih mata pelajaran." },
        { index: 3, value_template: "{{jenis}}", instruction: "Pilih jenis penilaian." },
        { index: 4, value_template: null, instruction: "Klik Tampilkan." },
        { index: 7, value_template: null, instruction: "Klik Simpan sekarang." },
      ],
    },
  });
  const procedure = await compileProcedure(
    { llm },
    {
      title: "Input nilai",
      events: RECORDING,
      narration: [{ start: 1_000, end: 2_500, text: "pilih kelasnya, misalnya 5A" }],
    },
  );

  assert.deepEqual(
    procedure.parameters.map((parameter) => parameter.name),
    ["kelas", "mapel", "jenis"],
  );
  const simpan = procedure.steps.at(-1)!;
  assert.deepEqual(
    [simpan.requiresHumanAction, simpan.instruction],
    [true, "Silakan tekan Simpan."],
  );
  assert.equal(procedure.steps.filter((step) => step.requiresHumanAction).length, 1);

  const run = instantiateProcedure(procedure, { kelas: "4B", mapel: "Matematika", jenis: "UTS" });
  assert.equal(run.status, "ok");
  if (run.status !== "ok") return;
  assert.deepEqual(
    run.steps.slice(1, 4).map((step) => step.value),
    ["4B", "Matematika", "UTS"],
  );
});

test("a template that names no declared parameter keeps the recorded literal", () => {
  const drafts = cleanRecording(RECORDING);
  const procedure = assembleProcedure("x", drafts, {
    title: "x",
    parameters: [],
    steps: [{ index: 1, value_template: "{{kelas}}", instruction: "Pilih kelas." }],
  });
  assert.equal(procedure.steps[1]?.valueTemplate, "5A");
  assert.deepEqual(procedure.parameters, []);
});

test("replay refuses to start without every parameter", () => {
  const drafts = cleanRecording(RECORDING);
  const procedure = assembleProcedure("x", drafts, {
    title: "x",
    parameters: [{ name: "kelas", label: "Kelas", question: "Kelas berapa?", example: "5A" }],
    steps: [{ index: 1, value_template: "{{kelas}}", instruction: "Pilih kelas." }],
  });
  const run = instantiateProcedure(procedure, {});
  assert.equal(run.status === "missing" && run.parameter.question, "Kelas berapa?");
});
