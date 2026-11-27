import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { importBpmn } from "./bpmn/graph.js";
import { planBpmnStep } from "./bpmn/plan.js";
import { F2_2_PAGE, F2_3_PAGE, KAMUS_ROWS, NOT_IN_GUIDE_PAGES } from "./fixtures/kamus.js";
import { BU_SITI, CLASS_4B, SOP_CHUNKS } from "./fixtures/sdit-nusantara.js";
import { F1_FINAL_VALUES } from "./fixtures/f1-photo.js";
import { applyAnswers, buildVerificationPlan } from "./grades/verification.js";
import { createFixtureSchoolAi, createSchoolAi } from "./runtime.js";

const ai = createFixtureSchoolAi();

test("offline mode reads any photo as the F1-1-shaped page, with its 10 questions", async () => {
  const result = await ai.readGradePhoto({
    image: { type: "image", dataUrl: "data:image/jpeg;base64,AA" },
    roster: CLASS_4B,
    assessment: "UTS",
  });
  assert.equal(result.status, "ok");
  assert.equal(
    result.status === "ok" && buildVerificationPlan(result.reading).questions.length,
    10,
  );
});

// 4B as 01_profil-sekolah lists it (WS-06 and the mock AlurSekolah), not the older test roster.
const PROFIL_4B = [
  "Ahmad Fadli",
  "Aisyah Zahra",
  "Alya Nur Fitri",
  "Bagas Saputra",
  "Budi Santoso",
  "Citra Ayu Lestari",
  "Dimas Pratama",
  "Dinda Maharani",
  "Fahri Hidayat",
  "Farah Annisa",
  "Galih Ramadhan",
  "Hana Salsabila",
  "Ilham Maulana",
  "Intan Permata",
  "Kevin Ardiansyah",
  "Laila Nur Azizah",
  "Muhammad Rizky",
  "Nabila Putri Ramadhani",
  "Naufal Akbar",
  "Nur Aini",
  "Putra Wijaya",
  "Qonita Rahma",
  "Raka Aditya",
  "Rani Oktaviani",
  "Salsabila Putri",
  "Siti Nur Haliza",
  "Taufik Hidayatullah",
  "Tiara Anjani",
  "Umar Faruq",
  "Vina Amelia",
  "Yusuf Alfarizi",
  "Zahra Khairunnisa",
].map((name, index) => ({ studentId: `s-${index + 1}`, name, number: index + 1 }));

test("offline mode writes the page for the roster it is given: 4 doubtful cells, then the truth", async () => {
  const result = await ai.readGradePhoto({
    image: { type: "image", dataUrl: "data:image/jpeg;base64,AA" },
    roster: PROFIL_4B,
    assessment: "UTS",
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const plan = buildVerificationPlan(result.reading);
  const digits = plan.questions.filter((question) => question.kind === "digit");
  assert.deepEqual(
    digits.map((question) => question.line),
    [3, 7, 10, 15],
  );
  assert.deepEqual(
    plan.questions.filter((question) => question.kind === "absence").map((q) => q.line),
    [21],
  );
  // F1-1: 5 names spelled differently and the S are asked too; the other 22 lines are accepted.
  assert.equal(plan.questions.length, 10);
  assert.equal(plan.acceptedCount, 22);

  const truth = (line: number) => String(F1_FINAL_VALUES[line - 1]);
  const answers = plan.questions.map((question) => ({
    questionId: question.id,
    answer:
      question.kind === "name"
        ? PROFIL_4B[question.line - 1]!.studentId
        : question.kind === "absence"
          ? "Kosongkan"
          : truth(question.line),
  }));
  for (const question of plan.questions) {
    if (question.kind === "name")
      assert.equal(question.options[0]?.studentId, PROFIL_4B[question.line - 1]!.studentId);
    if (question.kind === "digit") assert.ok(question.options.includes(truth(question.line)));
  }
  const applied = applyAnswers(result.reading, answers);
  assert.equal(applied.status, "ok");
  if (applied.status !== "ok") return;
  assert.equal(applied.entries.length, 32);
  for (const entry of applied.entries) {
    const line = PROFIL_4B.findIndex((student) => student.studentId === entry.studentId) + 1;
    const expected = F1_FINAL_VALUES[line - 1];
    assert.equal(entry.value, expected === "S" ? null : expected, entry.name);
  }
});

test("F2-2 offline: IPAS 4A not assigned is Pak Rizal's to fix (K-07), with a WhatsApp draft", async () => {
  const result = await ai.explainError({
    snapshot: F2_2_PAGE,
    question: "Nemu, ini kenapa?",
    kamus: KAMUS_ROWS,
    teacher: BU_SITI,
  });
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-07");
  assert.equal(
    result.sentence,
    "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
  );
  assert.equal(result.canSelfFix, false);
  assert.equal(result.waDraft?.phone, "6281200000002");
  assert.match(result.waDraft?.text ?? "", /^Assalamualaikum Pak Rizal\./u);
});

test("F2-3 offline: the teacher syncs Ruang GTK herself (K-02), no WhatsApp", async () => {
  const result = await ai.explainError({
    snapshot: F2_3_PAGE,
    question: "ini kenapa?",
    kamus: KAMUS_ROWS,
    teacher: BU_SITI,
  });
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-02");
  assert.deepEqual(
    [result.canSelfFix, result.guidedTarget, result.waDraft],
    [true, "Sinkro Ruang GTK", null],
  );
});

test("offline mode: screens the kamus doesn't cover offer the operator", async () => {
  for (const snapshot of Object.values(NOT_IN_GUIDE_PAGES)) {
    const result = await ai.explainError({
      snapshot,
      question: "ini kenapa?",
      kamus: KAMUS_ROWS,
      teacher: BU_SITI,
    });
    assert.equal(result.status, "not_in_guide");
    if (result.status !== "not_in_guide") return;
    assert.match(result.sentence, /^Belum ada di panduan sekolah\./u);
    assert.equal(result.waDraft?.phone, "6281200000002");
  }
});

test("offline mode answers from the SOP with a verified quote, and abstains otherwise", async () => {
  const kkm = await ai.answerGrounded({ question: "KKM nilai berapa?", chunks: SOP_CHUNKS });
  assert.equal(kkm.status, "answered");
  const cuti = await ai.answerGrounded({
    question: "cuti melahirkan berapa bulan?",
    chunks: SOP_CHUNKS,
  });
  assert.equal(cuti.status, "not_in_guide");
});

test("offline slot extraction plans F3-1 the same way the real model is expected to", async () => {
  const graph = await importBpmn(
    await readFile(
      join(import.meta.dirname, "../../src/school/fixtures/pengajuan-izin-guru.bpmn"),
      "utf8",
    ),
  );
  const slots = await ai.extractSlots({
    graph,
    teacherLanes: ["Guru"],
    text: "izin Kamis, anak sakit",
    today: "2026-12-01",
    known: {},
  });
  assert.deepEqual(slots, {
    jenis_izin: "keperluan_keluarga",
    tanggal_mulai: "2026-12-03",
    lama_hari: 1,
  });
  const plan = planBpmnStep({ graph, slots, stepIndex: 0, honorific: "Bu" });
  assert.equal(plan.step.kind === "fill" && plan.step.because, "Jadi tanpa surat dokter.");
});

test("without a TTS model the service returns text and timings for the local voice", async () => {
  const real = createSchoolAi({
    apiKey: "k",
    zdr: false,
    models: {
      readA: "a",
      readB: "b",
      reread: "a",
      script: "c",
      text: "t",
      transcription: "s",
      speech: "",
      speechVoice: "",
    },
    fetchImplementation: (async () => {
      throw new Error("no network in this test");
    }) as typeof fetch,
  });
  const speech = await real.synthesize("Silakan Ibu tekan Simpan.");
  assert.deepEqual([speech.audioBase64, speech.words.length, speech.timing], ["", 4, "estimated"]);
});
