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

test("offline mode explains a kamus error and names the fixer", async () => {
  const result = await ai.explainError({
    snapshot: {
      title: "Ruang GTK",
      url: null,
      texts: ["SKP belum bisa diajukan karena RHK atasan belum tersedia"],
      elements: [],
      screenshotBase64: null,
      blocked: false,
      blockedReason: null,
    },
    question: "ini kenapa",
    kamus: KAMUS_CHUNKS,
    teacher: BU_SITI,
  });
  assert.equal(
    result.status === "matched" && result.sentence,
    "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Ahmad (kepsek).",
  );
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
