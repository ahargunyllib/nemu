import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { importBpmn } from "./bpmn/graph.js";
import { stepDrafts, traceCause } from "./bpmn/trace.js";
import { BU_SITI } from "./fixtures/sdit-nusantara.js";
import {
  documentationSymptoms,
  explainProcess,
  isParentSafe,
  type GradeCheck,
  type SymptomCandidate,
} from "./process-help.js";
import { createFixtureSchoolAi, type SchoolAi } from "./runtime.js";
import { fakeJsonCall } from "./test-helpers.js";

const FIXTURES = join(import.meta.dirname, "../../src/school/fixtures");

async function sppGraph() {
  return importBpmn(await readFile(join(FIXTURES, "F2-1_alur-spp.bpmn"), "utf8"));
}

/** `F2-1_pertanyaan-dan-kunci.csv`: question, AlurSekolah grade data, cause, way back, fixer. */
async function f21Questions() {
  const csv = await readFile(join(FIXTURES, "F2-1_pertanyaan-dan-kunci.csv"), "utf8");
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const cells = [...line.matchAll(/"([^"]*)"|([^,]+)|(?<=,)(?=,|$)/gu)].map(
        (match) => match[1] ?? match[2] ?? "",
      );
      const [no, question, data, cause, wayBack, fixer] = cells;
      return { no, question: question!, saved: data === "tersimpan", cause, wayBack, fixer };
    });
}

async function candidates(ai: SchoolAi): Promise<SymptomCandidate[]> {
  const symptoms = await ai.suggestSymptoms({ graph: await sppGraph() });
  return Object.entries(symptoms).flatMap(([elementId, list]) =>
    list.map((symptom) => ({ documentId: "doc-spp", elementId, symptom })),
  );
}

test("F3-11: symptoms come from the uploaded BPMN, on the element that hides the grades", async () => {
  const symptoms = documentationSymptoms(await sppGraph());
  assert.deepEqual(symptoms.Task_KunciNilai, [
    "nilai tidak muncul di aplikasi orang tua",
    "rapor anak terlihat kosong di aplikasi orang tua",
  ]);
  assert.deepEqual(symptoms.Task_VerifikasiPembayaran, []);
});

test("F3-12: the walk finds the branch, the cause, the way back and Bu Ratna's task", async () => {
  const graph = await sppGraph();
  const trace = traceCause(graph, "Task_KunciNilai")!;
  assert.equal(trace.condition?.flow.id, "Flow_BelumLunas");
  assert.deepEqual(
    trace.wayBack.map((node) => node.id),
    [
      "Task_LunasiSpp",
      "Task_VerifikasiPembayaran",
      "Gateway_PembayaranSah",
      "Task_BukaKunciNilai",
      "End_NilaiTampil",
    ],
  );
  const steps = stepDrafts(graph, trace, "Task_VerifikasiPembayaran");
  assert.deepEqual(
    steps.map((step) => step.elementIds),
    [
      ["Gateway_JatuhTempo", "Flow_BelumLunas"],
      ["Task_KunciNilai"],
      ["Task_VerifikasiPembayaran"],
      ["Task_BukaKunciNilai"],
    ],
  );
});

test("F2-1: 3/3 questions from the CSV, with Bu Ratna and a safe parent reply", async () => {
  const ai = createFixtureSchoolAi();
  const graph = await sppGraph();
  const list = await candidates(ai);
  const questions = await f21Questions();
  assert.equal(questions.length, 3);
  for (const row of questions) {
    const match = await ai.matchSymptom({ question: row.question, candidates: list });
    assert.equal(match?.elementId, row.cause, `Q${row.no}: no symptom match`);
    const student = row.question.match(/\b(Budi|Nabila)\b/u)?.[1];
    const gradeCheck: GradeCheck =
      row.saved && student ? { status: "saved", student } : { status: "unknown" };
    const answer = await ai.explainProcess({
      question: row.question,
      process: { documentId: "doc-spp", title: "Alur Pembayaran SPP", version: "1", graph },
      match: match!,
      gradeCheck,
      teacher: BU_SITI,
    });
    assert.equal(answer?.status, "process", `Q${row.no}`);
    if (answer?.status !== "process") continue;
    assert.equal(answer.elementId, row.cause);
    assert.ok(answer.steps.some((step) => step.elementIds.includes(row.wayBack!)));
    assert.equal(`${answer.fixer?.name} (${answer.fixer?.role})`, row.fixer);
    assert.ok(answer.steps.length >= 2 && answer.steps.length <= 4);
    assert.ok(answer.parentReply && isParentSafe(answer.parentReply), answer.parentReply ?? "");
    assert.ok(!/tunggakan/iu.test(answer.parentReply));
    if (row.saved) {
      assert.equal(answer.certainty, "confirmed");
      assert.match(answer.sentence, new RegExp(`^Nilai ${student} sudah tersimpan\\.`, "u"));
    } else {
      assert.equal(answer.certainty, "likely");
      assert.match(answer.sentence, /^Kemungkinan /u);
      assert.match(answer.parentReply, /kemungkinan/u);
    }
    assert.match(answer.sentence, /Yang bisa membantu: Bu Ratna \(keuangan\)\.$/u);
  }
});

test("F3-14: a question no symptom describes matches nothing", async () => {
  const ai = createFixtureSchoolAi();
  const list = await candidates(ai);
  assert.equal(await ai.matchSymptom({ question: "Nemu, ini kenapa?", candidates: list }), null);
  assert.equal(
    await ai.matchSymptom({
      question: "Kenapa absen murid tidak bisa disimpan?",
      candidates: list,
    }),
    null,
  );
});

test("F3-13: grades AlurSekolah doesn't have mean the process isn't the cause", async () => {
  const ai = createFixtureSchoolAi();
  const answer = await ai.explainProcess({
    question: "Kenapa nilai Budi tidak muncul di aplikasi orang tua?",
    process: { documentId: "doc-spp", title: "SPP", version: "1", graph: await sppGraph() },
    match: {
      documentId: "doc-spp",
      elementId: "Task_KunciNilai",
      symptom: "nilai tidak muncul di aplikasi orang tua",
    },
    gradeCheck: { status: "not_saved", student: "Budi Santoso" },
    teacher: BU_SITI,
  });
  assert.deepEqual(answer, {
    status: "grades_not_saved",
    student: "Budi Santoso",
    sentence:
      "Nilai Budi Santoso belum tersimpan di AlurSekolah, jadi belum bisa tampil. Simpan dulu nilainya, Ibu.",
  });
});

test("a model reply with an amount or 'tunggakan' is replaced by the safe draft", async () => {
  const graph = await sppGraph();
  for (const bad of [
    "Mohon maaf, ada tunggakan SPP. Silakan hubungi Bu Ratna.",
    "Nilai belum tampil karena SPP Rp350.000 belum dibayar.",
  ]) {
    const llm = fakeJsonCall({
      process_help: (request) => {
        const data = JSON.parse((request.content[0] as { text: string }).text);
        return {
          why: "Karena SPP belum lunas.",
          steps: data.draf_langkah,
          parent_reply: bad,
        };
      },
    });
    const answer = await explainProcess(
      { llm },
      {
        question: "Kenapa nilai Budi tidak muncul?",
        process: { documentId: "d", title: "Alur Pembayaran SPP", version: "1", graph },
        match: { documentId: "d", elementId: "Task_KunciNilai", symptom: "nilai tidak muncul" },
        gradeCheck: { status: "saved", student: "Budi" },
        teacher: BU_SITI,
      },
    );
    assert.equal(answer?.status, "process");
    if (answer?.status !== "process") continue;
    assert.ok(answer.parentReply && isParentSafe(answer.parentReply));
    assert.ok(answer.parentReply.startsWith("Assalamualaikum, Bapak/Ibu."));
    assert.equal(answer.why, "Karena SPP belum lunas.");
  }
  assert.equal(isParentSafe("Mohon dilunasi 350 ribu"), false);
  assert.equal(isParentSafe("Bu Ratna di bagian keuangan bisa membantu."), true);
});
