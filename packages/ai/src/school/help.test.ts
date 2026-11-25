import assert from "node:assert/strict";
import test from "node:test";

import type { ScreenSnapshot } from "@nemu/contracts/school";

import { BU_SITI, KAMUS_CHUNKS } from "./fixtures/sdit-nusantara.js";
import { explainError } from "./help.js";
import { sentenceIssues } from "./safety.js";
import { fakeJsonCall, textOf } from "./test-helpers.js";

const RUANG_GTK: ScreenSnapshot = {
  title: "Ruang GTK - Pengelolaan Kinerja",
  url: "https://ruang.gtk.example/kinerja",
  texts: ["Data Perencanaan (SKP) belum bisa diajukan karena RHK atasan belum tersedia."],
  elements: [],
  screenshotBase64: "AAAA",
  blocked: false,
  blockedReason: null,
};

const MATCHED = {
  status: "matched",
  error_text: "SKP belum bisa diajukan karena RHK atasan belum tersedia",
  chunk_id: "kamus-k01",
  quote: "Kepala sekolah perlu membuat RHK terlebih dahulu di E-Kinerja",
  teacher_fault: false,
  fixer_role: "kepsek",
  can_self_fix: false,
  guided_target: null,
  why: "SKP Ibu menunggu RHK dari kepala sekolah.",
  app_name: "Ruang GTK",
};

test("W7: not the teacher's fault, names who fixes it, and drafts a WhatsApp with the NIP", async () => {
  const llm = fakeJsonCall({ stuck_help: MATCHED });
  const result = await explainError(
    { llm },
    { snapshot: RUANG_GTK, question: "Nemu, ini kenapa?", kamus: KAMUS_CHUNKS, teacher: BU_SITI },
  );
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.sentence, "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Ahmad (kepsek).");
  assert.deepEqual(sentenceIssues(result.sentence), []);
  assert.equal(result.citation.article, "K-01");
  assert.equal(result.waDraft?.phone, "6281200000001");
  assert.match(result.waDraft?.text ?? "", /NIP 197001012000032001/u);
  assert.match(result.waDraft?.text ?? "", /Screenshot terlampir/u);

  // The NIP and phone numbers are added by code, never sent to the model.
  const sent = textOf(llm.calls[0]!.content);
  assert.doesNotMatch(sent, /197001012000032001|6281200000001/u);
});

test("a fixer the kamus entry doesn't name is not trusted", async () => {
  const llm = fakeJsonCall({ stuck_help: { ...MATCHED, fixer_role: "operator" } });
  const result = await explainError(
    { llm },
    { snapshot: RUANG_GTK, question: null, kamus: KAMUS_CHUNKS, teacher: BU_SITI },
  );
  assert.equal(result.status, "not_in_guide");
});

test("F2-6: an error the kamus doesn't cover gets no invented cause and an offer to ask the operator", async () => {
  const llm = fakeJsonCall({
    stuck_help: {
      ...MATCHED,
      status: "not_in_guide",
      chunk_id: null,
      quote: null,
      fixer_role: null,
      error_text: "Error 502",
    },
  });
  const result = await explainError(
    { llm },
    { snapshot: RUANG_GTK, question: null, kamus: KAMUS_CHUNKS, teacher: BU_SITI },
  );
  assert.equal(result.status, "not_in_guide");
  if (result.status !== "not_in_guide") return;
  assert.equal(
    result.sentence,
    "Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?",
  );
  assert.equal(result.waDraft?.phone, "6281200000002");
});

test("the teacher can fix it: guided mode to the named button, no WhatsApp", async () => {
  const llm = fakeJsonCall({
    stuck_help: {
      ...MATCHED,
      chunk_id: "kamus-k02",
      quote: "Guru cukup masuk kembali dengan menekan tombol Masuk",
      teacher_fault: false,
      fixer_role: "guru",
      can_self_fix: true,
      guided_target: "Masuk",
    },
  });
  const result = await explainError(
    { llm },
    { snapshot: RUANG_GTK, question: null, kamus: KAMUS_CHUNKS, teacher: BU_SITI },
  );
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.deepEqual([result.canSelfFix, result.guidedTarget, result.waDraft], [true, "Masuk", null]);
  assert.equal(result.sentence, "Ibu bisa memperbaikinya sendiri, saya tunjukkan caranya.");
});

test("a blocked screen (password showing) is never sent anywhere", async () => {
  const llm = fakeJsonCall({});
  const result = await explainError(
    { llm },
    {
      snapshot: {
        ...RUANG_GTK,
        blocked: true,
        blockedReason: "password_field",
        screenshotBase64: null,
        texts: [],
      },
      question: null,
      kamus: KAMUS_CHUNKS,
      teacher: BU_SITI,
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(llm.calls.length, 0);
});
