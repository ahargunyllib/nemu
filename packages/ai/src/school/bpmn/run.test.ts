import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

import { imageDataUrl } from "../llm.js";
import { createFixtureSchoolAi } from "../runtime.js";
import { matchFieldLabels } from "./fields.js";
import { importBpmn } from "./graph.js";
import { planBpmnStep, taskAction } from "./plan.js";

/**
 * F3-1 (#213): the synthetic tahfidz BPMN runs through the same generic walk as the izin BPMN.
 * Nothing under test knows tahfidz: the file, its WS-04 page and the photo are the only inputs.
 */
const FIXTURES = join(import.meta.dirname, "../../../src/school/fixtures");
const TODAY = "2026-12-01";
const TEACHER = ["Guru", "guru"];

async function tahfidz() {
  return importBpmn(await readFile(join(FIXTURES, "F3-1_catat-hafalan-tahfidz.bpmn"), "utf8"));
}

async function kunci() {
  const [header, ...lines] = (await readFile(join(FIXTURES, "F3-1_kunci.csv"), "utf8"))
    .trim()
    .split("\n");
  const keys = header!.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i]!, v])));
}

// 01_profil-sekolah's 4A (synthetic), as WS-06 serves it.
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
];

const PAGES = {
  Task_CatatSetoran: { page: "Al-Quran › Setoran baru", source: "mapping" as const },
};

test("the teacher's sentence fills the start form, class and date; the book's columns are asked", async () => {
  const graph = await tahfidz();
  const ai = createFixtureSchoolAi();
  const slots = await ai.extractSlots({
    graph,
    teacherLanes: TEACHER,
    text: "Catat setoran hafalan 4A hari ini",
    today: TODAY,
    known: {},
  });
  assert.deepEqual(
    [slots.jenis_catatan, slots.kelas, slots.tanggal_setoran],
    ["setoran", "4A", TODAY],
  );
  assert.equal(slots.fashohah, undefined, "a score is never taken from the sentence");
  const plan = planBpmnStep({ graph, slots, stepIndex: 0, honorific: "Bu", teacherLanes: TEACHER });
  assert.deepEqual(plan.step, {
    kind: "ask",
    taskId: "Task_CatatSetoran",
    slot: "murid",
    question: "Murid apa, Bu?",
  });
});

test("an unclear sentence asks setoran or ujian from the start form before anything else", async () => {
  const graph = await tahfidz();
  const plan = planBpmnStep({
    graph,
    slots: {},
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.equal(plan.step.kind, "ask");
  assert.equal(plan.step.kind === "ask" && plan.step.slot, "jenis_catatan");
});

test("F3-1: the photo reads 3 rows matching the kunci; Citra's Tajwid is a question, not a guess", async () => {
  const graph = await tahfidz();
  const task = graph.nodes.Task_CatatSetoran!;
  const photo = await readFile(join(FIXTURES, "F3-1_foto-buku-setoran-tahfidz-4A.png"));
  const reading = await createFixtureSchoolAi().readFormPhoto({
    image: { type: "image", dataUrl: imageDataUrl(new Uint8Array(photo), "image/png") },
    fields: task.formFields.filter((field) => !["kelas", "tanggal_setoran"].includes(field.id)),
    roster: CLASS_4A.map((name, index) => ({
      studentId: `4a-${index + 1}`,
      name,
      number: index + 1,
    })),
    honorific: "Bu",
  });
  assert.equal(reading.status, "ok");
  if (reading.status !== "ok") return;
  assert.equal(reading.table.keyField, "murid");
  assert.deepEqual(reading.table.columns, [
    "surah",
    "ayat_dari",
    "ayat_sampai",
    "fashohah",
    "tartil",
    "tajwid",
    "adab",
  ]);
  assert.deepEqual(
    reading.questions.map((question) => [question.kind, question.rowName, question.prompt]),
    [["value", "Citra Lestari", "Tajwid Citra Lestari tidak terbaca jelas. Berapa, Bu?"]],
  );
  // The teacher answers 87; then every row matches the kunci.
  const rows = reading.table.rows.map((row) =>
    row.name === "Citra Lestari" ? { ...row, values: { ...row.values, tajwid: "87" } } : row,
  );
  const expected = await kunci();
  assert.equal(rows.length, 3);
  for (const want of expected) {
    const row = rows.find((item) => item.name === want.murid);
    assert.ok(row, `${want.murid} is missing`);
    for (const column of reading.table.columns)
      assert.equal(row.values[column], want[column], `${want.murid} ${column}`);
  }
});

test("with the photo's rows the walk is: kelas, date, one rows step, Simpan setoran; others announced", async () => {
  const graph = await tahfidz();
  const slots = { jenis_catatan: "setoran", kelas: "4A", tanggal_setoran: TODAY };
  const table = {
    keyField: "murid",
    columns: ["surah", "fashohah"],
    rows: [{ name: "Aisyah Putri Wijaya", values: { surah: "An-Naba'", fashohah: "90" } }],
  };
  const plan = planBpmnStep({
    graph,
    slots,
    table,
    pages: PAGES,
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    ["fill", "fill", "rows", "human", "done"],
  );
  assert.deepEqual(plan.steps[3], {
    kind: "human",
    taskId: "Task_CatatSetoran",
    action: "Simpan setoran",
    sentence: "Silakan Bu tekan Simpan setoran.",
  });
  assert.deepEqual(plan.tasks, [
    {
      taskId: "Task_CatatSetoran",
      name: "Catat Setoran Kelas",
      page: "Al-Quran › Setoran baru",
      pageSource: "mapping",
      action: "Simpan setoran",
    },
  ]);
  assert.deepEqual(plan.announcements, [
    "Sistem AlurSekolah: hitung nilai hafalan.",
    "Koordinator Tahfidz: periksa rekap tahfidz.",
  ]);
  assert.ok(plan.overview.length >= 2 && plan.overview.length <= 6, plan.overview.join(" | "));
  assert.deepEqual(plan.overview, [
    "Buka Al-Quran › Setoran baru.",
    "Guru mencatat setoran seluruh murid satu kelas sekaligus dari buku setoran.",
    "Ibu sendiri yang menekan Simpan setoran; Nemu berhenti sebelum itu.",
    "Sesudah itu, Sistem AlurSekolah: hitung nilai hafalan.",
    "Koordinator Tahfidz: periksa rekap tahfidz.",
  ]);
});

test("ujian takes the other branch from the BPMN condition: one student per form", async () => {
  const graph = await tahfidz();
  const plan = planBpmnStep({
    graph,
    slots: { jenis_catatan: "ujian", kelas: "4A" },
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.equal(plan.step.taskId, "Task_CatatUjian");
  assert.equal(taskAction(graph.nodes.Task_CatatUjian!), "Simpan ujian");
});

test("a task link in the BPMN (formKey or a halaman property) is read as its page", async () => {
  const xml = (await readFile(join(FIXTURES, "F3-1_catat-hafalan-tahfidz.bpmn"), "utf8")).replace(
    'name="Catat Setoran Kelas" camunda:candidateGroups="guru"',
    'name="Catat Setoran Kelas" camunda:candidateGroups="guru" camunda:formKey="Al-Quran › Setoran baru"',
  );
  const graph = await importBpmn(xml);
  assert.equal(graph.nodes.Task_CatatSetoran?.link, "Al-Quran › Setoran baru");
  assert.equal(graph.nodes.Task_CatatUjian?.link, null);
});

test("form fields find their page labels by meaning in code; a tie or nothing stays unmatched", () => {
  assert.deepEqual(
    matchFieldLabels(
      [
        { id: "kelas", label: "Kelas" },
        { id: "tanggal_setoran", label: "Tanggal setoran" },
        { id: "ayat_dari", label: "Dari ayat" },
        { id: "nilai", label: "Nilai akhir" },
      ],
      ["Pilih kelas", "Tanggal", "Dari ayat ke", "Catatan"],
    ),
    { kelas: "Pilih kelas", tanggal_setoran: "Tanggal", ayat_dari: "Dari ayat ke", nilai: null },
  );
});
