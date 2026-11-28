import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

import { imageDataUrl } from "../llm.js";
import { createFixtureSchoolAi } from "../runtime.js";
import { fakeJsonCall } from "../test-helpers.js";
import { matchFieldLabels } from "./fields.js";
import { readFormPhoto } from "./form-photo.js";
import { importBpmn } from "./graph.js";
import { planBpmnStep, taskAction } from "./plan.js";

/**
 * F3-1 (#213, #220): the official tahfidz BPMN runs through the same generic walk as the izin
 * BPMN. Nothing under test knows tahfidz: the file, its WS-04 page and the photo are the only
 * inputs.
 */
const FIXTURES = join(import.meta.dirname, "../../../src/school/fixtures");
const TODAY = "2026-12-01";
const TEACHER = ["Guru", "guru"];

async function bpmn(name: string) {
  return importBpmn(await readFile(join(FIXTURES, name), "utf8"));
}
const tahfidz = () => bpmn("F3-1_catat-hafalan-tahfidz.bpmn");

/** F3-1_kunci.csv; its last cell is quoted and holds commas, and only earlier columns are read. */
async function kunci() {
  const [header, ...lines] = (await readFile(join(FIXTURES, "F3-1_kunci.csv"), "utf8"))
    .trim()
    .split("\n");
  const keys = header!.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i]!, v])));
}

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

const PAGES = {
  Task_Setoran: { page: "Al-Quran › Setoran baru", source: "mapping" as const },
};
const COLUMNS = ["surah", "ayat_dari", "ayat_sampai", "fashohah", "tartil", "tajwid", "adab"];

test("the official BPMN's flows give each node its incoming and outgoing", async () => {
  const graph = await tahfidz();
  assert.deepEqual(graph.nodes.Gw_Jenis?.outgoing, ["F3", "F4"]);
  assert.deepEqual(graph.nodes.Task_Setoran?.incoming, ["F3"]);
  assert.deepEqual(graph.warnings, []);
});

test("the sentence picks class, Setoran and today; the steps show 3 teacher lines first", async () => {
  const graph = await tahfidz();
  const slots = await createFixtureSchoolAi().extractSlots({
    graph,
    teacherLanes: TEACHER,
    text: "Catat setoran hafalan 4A hari ini",
    today: TODAY,
    known: {},
  });
  assert.deepEqual(
    [slots.kelas, slots.jenis_catatan, slots.tanggal_setoran],
    ["4A", "Setoran", TODAY],
  );
  assert.equal(slots.fashohah, undefined, "a score is never taken from the sentence");
  const plan = planBpmnStep({
    graph,
    slots,
    pages: PAGES,
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  // The setoran form is still empty: Nemu asks for it (the photo answers it), not Simpan.
  assert.deepEqual(plan.step, {
    kind: "ask",
    taskId: "Task_Setoran",
    slot: "surah",
    question: "Surah apa, Bu?",
  });
  assert.deepEqual(plan.path.slice(0, 4), [
    "Start_1",
    "Task_PilihJenis",
    "Gw_Jenis",
    "Task_Setoran",
  ]);
  assert.deepEqual(plan.overview, [
    "Buka Al-Quran › Setoran baru.",
    "Pilih jenis catatan: kelas 4A, Setoran.",
    "Isi setoran satu kelas: tanggal setoran 1 Desember 2026, surah, dari ayat, sampai ayat, fashohah, tartil, tajwid, adab, catatan.",
    "Ibu sendiri yang menekan Simpan setoran; Nemu berhenti sebelum itu.",
    "Sesudah itu, Sistem AlurSekolah: hitung nilai dan huruf.",
    "Sistem AlurSekolah: tampilkan di aplikasi orang tua.",
  ]);
});

test("an unclear sentence asks Setoran or Ujian from the gateway before anything else", async () => {
  const graph = await tahfidz();
  const plan = planBpmnStep({
    graph,
    slots: { kelas: "4A" },
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.deepEqual(plan.step, {
    kind: "ask",
    taskId: "Gw_Jenis",
    slot: "jenis_catatan",
    question: "Jenis catatan Tahfidz yang mana, Bu? Setoran, Ujian.",
  });
});

test("F3-1: the official photo reads 3 rows matching the kunci; Citra's Tajwid is asked, not guessed", async () => {
  const graph = await tahfidz();
  const photo = await readFile(join(FIXTURES, "F3-1_foto-buku-setoran-tahfidz-4A.jpg"));
  const reading = await createFixtureSchoolAi().readFormPhoto({
    image: { type: "image", dataUrl: imageDataUrl(new Uint8Array(photo), "image/jpeg") },
    fields: graph.nodes.Task_Setoran!.formFields.filter((field) => field.id !== "tanggal_setoran"),
    roster: CLASS_4A,
    honorific: "Bu",
  });
  assert.equal(reading.status, "ok");
  if (reading.status !== "ok") return;
  assert.equal(reading.table.keyField, null, "the form has no student field; rows go by name");
  assert.deepEqual(reading.table.columns, COLUMNS);
  assert.deepEqual(
    reading.questions.map((question) => [question.kind, question.rowName, question.prompt]),
    [["value", "Citra Lestari", "Skor Tajwid Citra?"]],
  );
  // The teacher answers 87 (the kunci's note); then every row matches the kunci.
  const rows = reading.table.rows.map((row) =>
    row.name === "Citra Lestari" ? { ...row, values: { ...row.values, tajwid: "87" } } : row,
  );
  const expected = await kunci();
  assert.equal(rows.length, 3);
  for (const want of expected) {
    const row = rows.find((item) => item.name === want.murid);
    assert.ok(row, `${want.murid} is missing`);
    for (const column of COLUMNS)
      assert.equal(row.values[column], want[column], `${want.murid} ${column}`);
  }
});

test("any other photo reads as unreadable offline, so Nemu asks for a new one", async () => {
  const graph = await tahfidz();
  const reading = await createFixtureSchoolAi().readFormPhoto({
    image: {
      type: "image",
      dataUrl: imageDataUrl(new Uint8Array([0xff, 0xd8, 1, 2]), "image/jpeg"),
    },
    fields: graph.nodes.Task_Setoran!.formFields,
    roster: CLASS_4A,
    honorific: "Bu",
  });
  assert.equal(reading.status, "reshoot");
});

test("a scribbled score the model marks unreadable stays empty and becomes a question", async () => {
  const graph = await tahfidz();
  const llm = fakeJsonCall({
    form_photo: {
      readable: true,
      key_field: null,
      header: [],
      rows: [
        {
          line: 3,
          name: "Citra Lestari",
          box: null,
          cells: [
            { field: "tajwid", value: null, unreadable: true, candidates: ["87"], box: null },
            { field: "adab", value: "95", unreadable: false, candidates: [], box: null },
          ],
        },
      ],
    },
  });
  const reading = await readFormPhoto(llm, {
    image: { type: "image", dataUrl: "data:image/jpeg;base64,AA==" },
    fields: graph.nodes.Task_Setoran!.formFields,
    roster: CLASS_4A,
    honorific: "Bu",
  });
  assert.equal(reading.status, "ok");
  if (reading.status !== "ok") return;
  assert.deepEqual(reading.table.rows, [{ name: "Citra Lestari", values: { adab: "95" } }]);
  assert.deepEqual(reading.questions[0]?.candidates, ["87"]);
});

test("with the photo's rows the walk is: kelas, Setoran, date, one rows step, Simpan setoran", async () => {
  const graph = await tahfidz();
  const slots = { jenis_catatan: "Setoran", kelas: "4A", tanggal_setoran: TODAY };
  const table = {
    keyField: null,
    columns: COLUMNS,
    rows: [{ name: "Aisyah Putri Wijaya", values: { surah: "Al-'Asr", fashohah: "90" } }],
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
    plan.steps.map((step) => [step.kind, step.taskId]),
    [
      ["fill", "Task_Setoran"],
      ["fill", "Task_Setoran"],
      ["fill", "Task_Setoran"],
      ["rows", "Task_Setoran"],
      ["human", "Task_Setoran"],
      ["done", "Task_Hitung"],
    ],
  );
  assert.deepEqual(
    plan.steps.flatMap((step) => (step.kind === "fill" ? step.fields : [])),
    [
      { fieldId: "kelas", label: "Kelas", value: "4A" },
      { fieldId: "jenis_catatan", label: "Jenis catatan Tahfidz", value: "Setoran" },
      { fieldId: "tanggal_setoran", label: "Tanggal setoran", value: TODAY },
    ],
  );
  assert.deepEqual(plan.steps[4], {
    kind: "human",
    taskId: "Task_Setoran",
    action: "Simpan setoran",
    sentence: "Silakan Bu tekan Simpan setoran.",
  });
  // "Pilih jenis catatan" names no button: it is done on the way, in the same run.
  assert.deepEqual(plan.tasks, [
    {
      taskId: "Task_Setoran",
      name: "Isi setoran satu kelas",
      page: "Al-Quran › Setoran baru",
      pageSource: "mapping",
      action: "Simpan setoran",
    },
  ]);
  assert.deepEqual(plan.announcements, [
    "Sistem AlurSekolah: hitung nilai dan huruf.",
    "Sistem AlurSekolah: tampilkan di aplikasi orang tua.",
  ]);
});

test("Ujian takes the other branch from the BPMN condition: one student per form", async () => {
  const graph = await tahfidz();
  const plan = planBpmnStep({
    graph,
    slots: { jenis_catatan: "Ujian", kelas: "4A", tanggal_ujian: TODAY },
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.deepEqual(plan.step, {
    kind: "ask",
    taskId: "Task_Ujian",
    slot: "murid",
    question: "Murid apa, Bu?",
  });
  assert.equal(taskAction(graph.nodes.Task_Ujian!), "Simpan ujian");
});

test("a task link in the BPMN (formKey or a halaman property) is read as its page", async () => {
  const xml = (await readFile(join(FIXTURES, "F3-1_catat-hafalan-tahfidz.bpmn"), "utf8")).replace(
    'name="Isi setoran satu kelas" camunda:assignee="guru"',
    'name="Isi setoran satu kelas" camunda:assignee="guru" camunda:formKey="Al-Quran › Setoran baru"',
  );
  const graph = await importBpmn(xml);
  assert.equal(graph.nodes.Task_Setoran?.link, "Al-Quran › Setoran baru");
  assert.equal(graph.nodes.Task_Ujian?.link, null);
});

test("the v2.2 izin BPMN (assignee, no lanes) plans through the same code to Ajukan", async () => {
  const graph = await bpmn("F3-1_pengajuan-izin-guru.bpmn");
  const slots = await createFixtureSchoolAi().extractSlots({
    graph,
    teacherLanes: TEACHER,
    text: "izin Kamis, anak saya sakit",
    today: TODAY,
    known: {},
  });
  assert.deepEqual(slots, {
    tanggal_mulai: "2026-12-03",
    jumlah_hari: 1,
    jenis_izin: "keperluan_keluarga",
  });
  const asked = planBpmnStep({
    graph,
    slots,
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.deepEqual(asked.step, {
    kind: "ask",
    taskId: "Task_IsiForm",
    slot: "alasan",
    question: "Alasan apa, Bu?",
  });
  const plan = planBpmnStep({
    graph,
    slots: { ...slots, alasan: "Mengantar anak ke dokter" },
    stepIndex: 0,
    honorific: "Bu",
    teacherLanes: TEACHER,
  });
  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    ["fill", "fill", "fill", "fill", "human", "done"],
  );
  assert.equal(plan.steps[4]?.kind === "human" && plan.steps[4].action, "Ajukan");
  assert.equal(plan.step.taskId, "Task_IsiForm");
  assert.deepEqual(plan.announcements, [
    "Kepala sekolah: persetujuan Kepala Sekolah.",
    "Admin: rekap Kehadiran oleh Admin.",
  ]);
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
