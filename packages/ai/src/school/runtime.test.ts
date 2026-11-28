import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { retrieveKnowledge, type KnowledgeChunk } from "../knowledge.js";
import { bpmnKnowledgeTexts, importBpmn } from "./bpmn/graph.js";
import { planBpmnStep } from "./bpmn/plan.js";
import { F2_2_PAGE, F2_3_PAGE, KAMUS_ROWS, NOT_IN_GUIDE_PAGES } from "./fixtures/kamus.js";
import { BU_SITI, SOP_CHUNKS } from "./fixtures/sdit-nusantara.js";
import { F1_BOOK, F1_FINAL_VALUES, F1_ROSTER } from "./fixtures/f1-photo.js";
import { applyAnswers, buildVerificationPlan } from "./grades/verification.js";
import { createFixtureSchoolAi, createSchoolAi } from "./runtime.js";

const ai = createFixtureSchoolAi();

test("offline mode reads any photo as the official F1-1 page, with its 10 questions", async () => {
  const result = await ai.readGradePhoto({
    image: { type: "image", dataUrl: "data:image/jpeg;base64,AA" },
    roster: F1_ROSTER,
    assessment: "UTS",
  });
  assert.equal(result.status, "ok");
  assert.equal(
    result.status === "ok" && buildVerificationPlan(result.reading).questions.length,
    10,
  );
});

const PROFIL_4B = F1_ROSTER;

test("offline mode: 4 doubtful cells, 5 names and the S asked, then the book's values", async () => {
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
    [7, 10, 20, 28],
  );
  assert.deepEqual(
    plan.questions.filter((question) => question.kind === "absence").map((q) => q.line),
    [23],
  );
  // F1-1: 5 names spelled differently and the S are asked too; the other 22 lines are accepted.
  assert.equal(plan.questions.length, 10);
  assert.equal(plan.acceptedCount, 22);

  const truth = (line: number) => String(F1_FINAL_VALUES[line - 1]);
  const studentOf = (line: number) => {
    const written = F1_BOOK[line - 1]!;
    const name = written.rosterName ?? written.name;
    return PROFIL_4B.find((student) => student.name === name)!.studentId;
  };
  const answers = plan.questions.map((question) => ({
    questionId: question.id,
    answer:
      question.kind === "name"
        ? studentOf(question.line)
        : question.kind === "absence"
          ? "Kosongkan"
          : truth(question.line),
  }));
  for (const question of plan.questions) {
    if (question.kind === "name")
      assert.equal(question.options[0]?.studentId, studentOf(question.line));
    if (question.kind === "digit" && question.options.length)
      assert.ok(question.options.includes(truth(question.line)), question.prompt);
  }
  const applied = applyAnswers(result.reading, answers);
  assert.equal(applied.status, "ok");
  if (applied.status !== "ok") return;
  assert.equal(applied.entries.length, 32);
  for (const entry of applied.entries) {
    const line =
      F1_BOOK.findIndex((written) => (written.rosterName ?? written.name) === entry.name) + 1;
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

const sopTahfidzPoint = (article: string, text: string): KnowledgeChunk => ({
  id: `sop-tahfidz-page-1-pasal-${article.split(" ")[0]}-ayat-${article.split(" ").at(-1)}`,
  docId: "sop-tahfidz",
  title: "SOP Tahfidz",
  version: "2026",
  article,
  page: 1,
  active: true,
  text,
});

const SOP_TAHFIDZ_CHUNKS = [
  sopTahfidzPoint(
    "1 ayat 1.1",
    "Pasal 1. Tujuan\n1.1 Menjadi pedoman guru dalam menyimak, menilai, dan mencatat setoran hafalan Al-Quran\nmurid di AlurSekolah.",
  ),
  sopTahfidzPoint(
    "2 ayat 2.1",
    "Pasal 2. Ruang lingkup\n2.1 Berlaku untuk setoran hafalan dan ujian tahfidz murid kelas 1 sampai 6.",
  ),
  sopTahfidzPoint("2 ayat 2.2", "2.2 Berlaku untuk wali kelas dan guru tahfidz."),
  sopTahfidzPoint(
    "3 ayat 3.1",
    "Pasal 3. Setoran hafalan\n3.1 Setoran dilakukan paling sedikit 2 kali dalam seminggu.",
  ),
  sopTahfidzPoint(
    "3 ayat 3.2",
    "3.2 Setiap setoran paling sedikit 3 ayat. Surah yang kurang dari 3 ayat disetorkan utuh.",
  ),
  sopTahfidzPoint(
    "3 ayat 3.3",
    "3.3 Setoran dicatat di buku setoran pada saat menyimak, lalu dimasukkan ke AlurSekolah\n(menu Al-Quran › Tahfidz › Setoran baru) pada hari yang sama.",
  ),
  sopTahfidzPoint(
    "3 ayat 3.4",
    "3.4 Murid yang tidak setor pada hari itu dibiarkan kosong, tidak diberi skor 0.",
  ),
  sopTahfidzPoint(
    "4 ayat 4.1",
    "Pasal 4. Penilaian setoran\n4.1 Setiap setoran dinilai pada empat aspek: Fashohah 30%, Tartil 30%, Tajwid 30%, dan\nAdab 10%.",
  ),
  sopTahfidzPoint("4 ayat 4.2", "4.2 Skor tiap aspek ditulis dalam skala 0 sampai 100."),
  sopTahfidzPoint("4 ayat 4.3", "4.3 Aspek Adab dinilai oleh wali kelas."),
  sopTahfidzPoint(
    "4 ayat 4.4",
    "4.4 Skor yang tidak terbaca di buku setoran tidak boleh ditebak. Tanyakan ke guru yang\nmenyimak sebelum dimasukkan.",
  ),
  sopTahfidzPoint(
    "5 ayat 5.1",
    "Pasal 5. Ujian tahfidz\n5.1 Ujian dilakukan per juz, setelah murid menyelesaikan setoran satu juz.",
  ),
  sopTahfidzPoint(
    "5 ayat 5.2",
    "5.2 Ujian dicatat satu murid per form melalui menu Al-Quran › Tahfidz › Ujian baru.",
  ),
  sopTahfidzPoint(
    "5 ayat 5.3",
    "5.3 Murid dinyatakan lulus ujian juz jika nilai akhirnya paling rendah 75. Murid yang belum\nlulus mengulang paling cepat 7 hari setelah ujian.",
  ),
  sopTahfidzPoint(
    "6 ayat 6.1",
    "Pasal 6. Penanggung jawab\n6.1 Guru tahfidz: menyimak, menilai, dan mencatat setoran.",
  ),
  sopTahfidzPoint(
    "6 ayat 6.2",
    "6.2 Wali kelas: menilai Adab dan memastikan setoran kelasnya tercatat.",
  ),
  sopTahfidzPoint("6 ayat 6.3", "6.3 Koordinator Tahfidz: menjadwalkan ujian juz."),
];

test("a rule question cites the SOP point, not a recorded procedure's field list (#264)", async () => {
  const graph = await importBpmn(
    await readFile(
      join(import.meta.dirname, "../../src/school/fixtures/F3-1_catat-hafalan-tahfidz.bpmn"),
      "utf8",
    ),
  );
  const procedure = bpmnKnowledgeTexts(graph).map((item, sequence): KnowledgeChunk => ({
    id: `f3-1-tahfidz-task-${sequence + 1}`,
    docId: "f3-1-tahfidz",
    title: "Catat hafalan tahfidz",
    version: "2026",
    article: item.article,
    active: true,
    text: item.text,
  }));

  const result = await ai.answerGrounded({
    question: "Setoran minimal berapa ayat?",
    chunks: [...SOP_TAHFIDZ_CHUNKS, ...procedure],
  });

  assert.equal(result.status, "answered");
  if (result.status !== "answered") return;
  assert.equal(result.citations[0]?.chunkId, "sop-tahfidz-page-1-pasal-3-ayat-3.2");
  assert.match(result.answer, /3 ayat/u);
});

const tentangNemuPoint = (article: string, text: string): KnowledgeChunk => ({
  id: `tentang-nemu-${article}`,
  docId: "tentang-nemu",
  title: "Tentang Nemu",
  version: "2026",
  article,
  active: true,
  text,
});

test("a kenapa question matches the topic, not a point that quotes ini kenapa?", async () => {
  const chunks = [
    tentangNemuPoint(
      "2.4",
      '2.4 Menjelaskan error: tanyakan "ini kenapa?" saat muncul pesan error atau nilai tidak muncul. Nemu menjelaskan penyebabnya dan siapa yang bisa membantu.',
    ),
    tentangNemuPoint(
      "4.3",
      "4.3 Kalau Nemu tetap tidak mendengar, periksa mikrofon komputer, lalu coba lagi.",
    ),
  ];
  const question = "Kenapa Nemu tidak bisa mendengar saya?";

  assert.equal(retrieveKnowledge(chunks, question, 1)[0]?.article, "4.3");

  const result = await ai.answerGrounded({ question, chunks });
  assert.equal(result.status, "answered");
  if (result.status !== "answered") return;
  assert.equal(result.citations[0]?.article, "4.3");
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
