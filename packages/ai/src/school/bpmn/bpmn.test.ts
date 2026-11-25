import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

import { fakeJsonCall } from "../test-helpers.js";
import { evaluateCondition, juelToJexl } from "./conditions.js";
import { bpmnKnowledgeTexts, importBpmn } from "./graph.js";
import { extractSlots, planBpmnStep, resolveWeekday, upcomingDates } from "./plan.js";

const FIXTURE = join(import.meta.dirname, "../../../src/school/fixtures/pengajuan-izin-guru.bpmn");
const TODAY = "2026-12-01"; // PRD §10: test date is Tuesday 1 December 2026.

async function izinGraph() {
  return importBpmn(await readFile(FIXTURE, "utf8"));
}

test("a Camunda 7 BPMN becomes tasks, lanes, form fields and gateway conditions", async () => {
  const graph = await izinGraph();
  assert.equal(graph.name, "Pengajuan Izin Guru");
  assert.deepEqual(graph.lanes, ["Guru", "Kepala Sekolah"]);
  const form = graph.nodes.Task_IsiFormIzin!;
  assert.equal(form.lane, "Guru");
  assert.deepEqual(
    form.formFields.map((field) => [field.id, field.type, field.required]),
    [
      ["jenis_izin", "enum", true],
      ["tanggal_mulai", "date", true],
      ["lama_hari", "long", true],
      ["keterangan", "string", false],
    ],
  );
  assert.equal(graph.nodes.Gateway_SuratDokter?.defaultFlow, "Flow_TanpaSurat");
  assert.deepEqual(graph.flows.Flow_PerluSurat?.condition, {
    language: "juel",
    body: "${jenis_izin == 'sakit' && lama_hari > 1}",
  });
  assert.equal(graph.nodes.Task_UnggahSuratDokter?.formFields[0]?.type, "file");
  assert.deepEqual(graph.warnings, []);
});

test("JUEL and FEEL conditions evaluate in code, and a missing variable is reported, not guessed", () => {
  assert.equal(juelToJexl("${jenis eq 'sakit' and hari gt 1}"), "jenis == 'sakit' && hari > 1");
  const juel = { language: "juel", body: "${jenis_izin == 'sakit' && lama_hari > 1}" } as const;
  assert.deepEqual(evaluateCondition(juel, { jenis_izin: "sakit", lama_hari: 2 }), {
    result: true,
  });
  assert.deepEqual(evaluateCondition(juel, { jenis_izin: "keperluan_keluarga", lama_hari: 1 }), {
    result: false,
  });
  assert.deepEqual(evaluateCondition(juel, { jenis_izin: "sakit" }), { missing: ["lama_hari"] });
  assert.deepEqual(
    evaluateCondition({ language: "juel", body: "${status.equals('ok')}" }, { status: "ok" }),
    { result: true },
  );
  const feel = { language: "feel", body: 'jenis_izin = "sakit" and lama_hari > 1' } as const;
  assert.deepEqual(evaluateCondition(feel, { jenis_izin: "sakit", lama_hari: 3 }), {
    result: true,
  });
  assert.ok("unsupported" in evaluateCondition({ language: "label", body: "Sakit > 1 hari" }, {}));
});

test("'Kamis' from Tuesday 1 Dec 2026 is 3 Dec 2026", () => {
  assert.equal(resolveWeekday("izin Kamis, anak sakit", TODAY), "2026-12-03");
  assert.equal(resolveWeekday("besok", TODAY), "2026-12-02");
  assert.equal(resolveWeekday("Selasa depan", TODAY), "2026-12-08");
  assert.deepEqual(upcomingDates(TODAY, 3), [
    { date: "2026-12-01", hari: "Selasa" },
    { date: "2026-12-02", hari: "Rabu" },
    { date: "2026-12-03", hari: "Kamis" },
  ]);
});

test("F3-1: 'izin Kamis, anak sakit' → keperluan keluarga, 3 Des, 1 hari, no doctor's note, then kepsek", async () => {
  const graph = await izinGraph();
  const llm = fakeJsonCall({
    form_slots: {
      jenis_izin: "keperluan_keluarga",
      tanggal_mulai: "2026-12-04",
      lama_hari: 1,
      keterangan: "anak sakit",
    },
  });
  const slots = await extractSlots(llm, {
    graph,
    teacherLanes: ["Guru"],
    text: "izin Kamis, anak sakit",
    today: TODAY,
    known: {},
  });
  assert.equal(
    slots.tanggal_mulai,
    "2026-12-03",
    "the weekday the teacher said wins over a model date",
  );

  const steps = [0, 1, 2, 3, 4, 5].map(
    (stepIndex) => planBpmnStep({ graph, slots, stepIndex, honorific: "Bu" }).step,
  );
  assert.deepEqual(
    steps.map((step) =>
      step.kind === "fill"
        ? step.sentence
        : `${step.kind}: ${"sentence" in step ? step.sentence : ""}`,
    ),
    [
      'Pilih "Keperluan keluarga".',
      "Isi tanggal Kamis, 3 Desember 2026.",
      "Isi lama izin (hari): 1.",
      "Isi keterangan: anak sakit.",
      "human: Silakan Bu tekan Ajukan.",
      "done: Setelah diajukan, lanjut ke Persetujuan Kepala Sekolah.",
    ],
  );
  const first = steps[0]!;
  assert.equal(first.kind === "fill" && first.because, "Jadi tanpa surat dokter.");
  const plan = planBpmnStep({ graph, slots, stepIndex: 0, honorific: "Bu" });
  assert.deepEqual(plan.path, [
    "Start_Izin",
    "Task_IsiFormIzin",
    "Gateway_SuratDokter",
    "Gateway_Gabung",
    "Task_PersetujuanKepsek",
  ]);
  assert.equal(plan.activeTaskId, "Task_IsiFormIzin");
  assert.equal(plan.stepCount, 5);
});

test("sick for two days takes the doctor's-note branch, which is the teacher's upload", async () => {
  const graph = await izinGraph();
  const slots = { jenis_izin: "sakit", tanggal_mulai: "2026-12-03", lama_hari: 2 };
  const plans = [0, 1, 2, 3, 4].map((stepIndex) =>
    planBpmnStep({ graph, slots, stepIndex, honorific: "Bu" }),
  );
  assert.deepEqual(
    plans.map((plan) => plan.step.kind),
    ["fill", "fill", "fill", "human", "human"],
  );
  const upload = plans[3]!.step;
  assert.equal(upload.kind === "human" && upload.action, "Unggah Surat dokter");
  assert.ok(plans[0]!.path.includes("Task_UnggahSuratDokter"));
});

test("a missing required field becomes one question before any branch is chosen", async () => {
  const graph = await izinGraph();
  const plan = planBpmnStep({
    graph,
    slots: { jenis_izin: "sakit" },
    stepIndex: 0,
    honorific: "Bu",
  });
  assert.deepEqual(plan.step, {
    kind: "ask",
    taskId: "Task_IsiFormIzin",
    slot: "tanggal_mulai",
    question: "Tanggal berapa, Bu?",
  });
});

test("an enum value the model invents is dropped instead of filled", async () => {
  const graph = await izinGraph();
  const llm = fakeJsonCall({
    form_slots: {
      jenis_izin: "cuti_tahunan",
      tanggal_mulai: null,
      lama_hari: null,
      keterangan: null,
    },
  });
  const slots = await extractSlots(llm, {
    graph,
    teacherLanes: ["Guru"],
    text: "cuti",
    today: TODAY,
    known: {},
  });
  assert.deepEqual(slots, {});
});

test("each task becomes a citable knowledge text", async () => {
  const texts = bpmnKnowledgeTexts(await izinGraph());
  const gateway = texts.find(
    (item) => item.article === "Pengajuan Izin Guru › Perlu surat dokter?",
  );
  assert.match(gateway?.text ?? "", /Sakit lebih dari 1 hari → Unggah Surat Dokter/u);
});
