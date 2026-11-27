import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { importBpmn } from "./bpmn/graph.js";
import { planBpmnStep } from "./bpmn/plan.js";
import { BU_SITI, CLASS_4B, KAMUS_CHUNKS, SOP_CHUNKS } from "./fixtures/sdit-nusantara.js";
import { buildVerificationPlan } from "./grades/verification.js";
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

const PAGE = {
  title: "Ruang GTK",
  url: "https://ruang.gtk.example/kinerja",
  alerts: [] as string[],
  headings: [] as string[],
  fields: [],
  screenshotBase64: null,
};

test("offline mode explains a kamus error and names the fixer", async () => {
  const result = await ai.explainError({
    snapshot: { ...PAGE, alerts: ["SKP belum bisa diajukan karena RHK atasan belum tersedia"] },
    question: "ini kenapa",
    kamus: KAMUS_CHUNKS,
    teacher: BU_SITI,
  });
  assert.equal(
    result.status === "matched" && result.sentence,
    "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Ahmad (kepsek).",
  );
});

test("F2-2 offline: an unassigned subject is Pak Rizal's to fix (K-07), with a WhatsApp draft", async () => {
  const result = await ai.explainError({
    snapshot: {
      ...PAGE,
      title: "AlurSekolah (tiruan)",
      alerts: [
        "Tidak dapat menampilkan siswa Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
      ],
      headings: ["Isi nilai kelas"],
      fields: [
        { label: "Kelas", value: "4A" },
        { label: "Mata pelajaran", value: "IPAS" },
      ],
    },
    question: "Nemu, ini kenapa?",
    kamus: KAMUS_CHUNKS,
    teacher: BU_SITI,
  });
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-07");
  assert.equal(result.sentence, "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).");
  assert.equal(result.canSelfFix, false);
  assert.equal(result.waDraft?.phone, "6281200000002");
  assert.match(result.waDraft?.text ?? "", /^Assalamualaikum Pak Rizal\./u);
  assert.doesNotMatch(result.waDraft?.text ?? "", /screenshot/iu);
});

test("F2-3 offline: the teacher syncs Ruang GTK herself (K-02), no WhatsApp", async () => {
  const result = await ai.explainError({
    snapshot: {
      ...PAGE,
      alerts: [
        'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja Alasan: Tidak ditandai sebagai User Ruang GTK. Mohon coba lagi atau Anda dapat juga menekan tombol "Sinkro Ruang GTK" di E-Kinerja dan ikuti petunjuknya.',
      ],
      headings: ["Pengelolaan Kinerja 2026"],
    },
    question: "ini kenapa?",
    kamus: KAMUS_CHUNKS,
    teacher: BU_SITI,
  });
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-02");
  assert.deepEqual(
    [result.canSelfFix, result.guidedTarget, result.waDraft],
    [true, "Sinkro Ruang GTK", null],
  );
  assert.match(result.citation.quote, /menu E-Kinerja/u);
});

test("offline mode: an error the kamus doesn't cover offers the operator", async () => {
  const result = await ai.explainError({
    snapshot: { ...PAGE, alerts: ["Error 502 Bad Gateway"] },
    question: "ini kenapa?",
    kamus: KAMUS_CHUNKS,
    teacher: BU_SITI,
  });
  assert.equal(result.status, "not_in_guide");
  if (result.status !== "not_in_guide") return;
  assert.match(result.sentence, /^Belum ada di panduan sekolah\./u);
  assert.equal(result.waDraft?.phone, "6281200000002");
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
