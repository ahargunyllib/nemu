import assert from "node:assert/strict";
import test from "node:test";

import {
  matchVoiceControl,
  normalizeUtterance,
  parseGradeCommand,
  quizCommand,
  routeCommand,
} from "./commands.js";
import { commandIntent, F0_2_COMMANDS, intentMatches } from "./fixtures/f0-2-commands.js";
import { BU_SITI } from "./fixtures/sdit-nusantara.js";

test("voice controls are recognized in code, before any model", () => {
  assert.equal(matchVoiceControl("Berhenti!"), "berhenti");
  assert.equal(matchVoiceControl("nemu, stop"), "berhenti");
  assert.equal(matchVoiceControl("saya saja"), "saya_saja");
  assert.equal(matchVoiceControl("Ya, saya isi sendiri"), "saya_saja");
  assert.equal(matchVoiceControl("lanjut"), "lanjut");
  assert.equal(matchVoiceControl("ulangi"), "ulangi");
  assert.equal(matchVoiceControl("ajari saya"), "ajari_saya");
  assert.equal(matchVoiceControl("masukkan nilai UTS"), null);
});

test("every F0-15 control is matched, with the words around it that change nothing", () => {
  for (const [words, control] of [
    ["Pelan", "pelan"],
    ["Nemu, pelan-pelan ya", "pelan"],
    ["lebih pelan dong", "pelan"],
    ["Nemu, tolong ulangi ya.", "ulangi"],
    ["sekali lagi, nggih", "ulangi"],
    ["Ajari saya, Nemu", "ajari_saya"],
    ["ajarin saya dong", "ajari_saya"],
    ["Lanjutkan saja", "lanjut"],
    ["Mangga lanjut", "lanjut"],
    ["Berhenti dulu, Nemu", "berhenti"],
  ] as const)
    assert.equal(matchVoiceControl(words), control, words);
  // A control word inside a request is the request, not the control.
  for (const words of [
    "Ajari saya ngisi nilai sendiri, ya.",
    "Ulangi pertanyaan saya tentang KKM",
    "Terus kenapa nilainya tidak muncul?",
    "Pelan-pelan saja isi nilai 4B",
  ])
    assert.equal(matchVoiceControl(words), null, words);
});

test("spoken Javanese and recognizer slips become the Indonesian the rules read", () => {
  assert.equal(
    normalizeUtterance("Nemu, tulung isiake nilai UTS Matematika 4A."),
    "nemu tolong isi nilai uts matematika 4a.",
  );
  assert.equal(normalizeUtterance("nilaine Aisyah kok ora metu"), "nilai aisyah kok tidak muncul");
  assert.equal(normalizeUtterance("kelas papat a, U T S"), "kelas 4a uts");
  assert.equal(normalizeUtterance("empat B"), "4b");
});

for (const { no, sentence, expected, variants } of F0_2_COMMANDS) {
  test(`F0-2 no. ${no}: "${sentence}" and how a recognizer may write it`, () => {
    for (const words of [sentence, ...variants]) {
      const actual = commandIntent(words);
      assert.ok(intentMatches(actual, expected), `${words} → ${JSON.stringify(actual)}`);
    }
  });
}

test("F0-2: at least 8 of the 10 sentences pass as text (here all 10)", () => {
  const correct = F0_2_COMMANDS.filter(({ sentence, expected }) =>
    intentMatches(commandIntent(sentence), expected),
  ).length;
  assert.equal(correct, 10);
});

test("the extension's own quiz commands are told apart, and grades for a quiz stay F1's", () => {
  assert.equal(quizCommand("Nemu, tolong cek kuis ini."), "quiz-check");
  assert.equal(quizCommand("check this quiz"), "quiz-check");
  assert.equal(quizCommand("ganti ulangan IPAS minggu lalu"), "quiz-delete");
  assert.equal(quizCommand("naskah soal ini jadikan kuis di Moodle ya"), "quiz-import");
  assert.equal(
    quizCommand(
      "Nemu, masukkan kuis dari naskah ini ke Moodle. Buka Senin 7 Desember, tutup Kamis 10 Desember.",
    ),
    "quiz-import",
  );
  assert.equal(quizCommand("masukkan nilai kuis IPAS 4A"), null);
  assert.equal(quizCommand("Kuis IPAS dibuka kapan?"), null);
  assert.equal(quizCommand("Kenapa soal di Moodle tidak muncul?"), null);
  assert.equal(quizCommand("Bagaimana cara menghapus nilai?"), null);
});

test("commands are routed to the right feature", () => {
  assert.deepEqual(routeCommand("Nemu, masukkan nilai UTS Matematika 4B"), {
    kind: "intent",
    intent: "input_nilai",
    processName: null,
  });
  assert.deepEqual(routeCommand("Nemu, ini kenapa?"), {
    kind: "intent",
    intent: "kenapa",
    processName: null,
  });
  // F2-1: grades she already entered that parents can't see is a "why", not grade entry.
  for (const question of [
    "Nilai Budi sudah saya masukkan, tapi kenapa tidak muncul di aplikasi orang tua?",
    "Orang tua Nabila bilang nilainya belum kelihatan di aplikasi orang tua, kok bisa?",
    "Nilai yang saya isi tidak tampil di aplikasi orang tua",
  ]) {
    assert.deepEqual(routeCommand(question), {
      kind: "intent",
      intent: "kenapa",
      processName: null,
    });
  }
  assert.deepEqual(routeCommand("saya mau izin Kamis, anak sakit", ["Pengajuan Izin Guru"]), {
    kind: "intent",
    intent: "proses",
    processName: "Pengajuan Izin Guru",
  });
  assert.deepEqual(routeCommand("KKM matematika berapa?"), {
    kind: "intent",
    intent: "tanya",
    processName: null,
  });
});

test("the grade command takes class, subject and assessment from the teacher's own lists", () => {
  assert.deepEqual(parseGradeCommand("masukkan nilai UTS Matematika 4B", BU_SITI), {
    status: "ok",
    className: "4B",
    subject: "Matematika",
    assessment: "UTS",
  });
  assert.deepEqual(parseGradeCommand("input nilai ulangan harian 2 IPA kelas empat b", BU_SITI), {
    status: "ok",
    className: "4B",
    subject: "IPA",
    assessment: "UH 2",
  });
});

test("a missing part becomes one short question", () => {
  const multiClass = { ...BU_SITI, classes: ["4A", "4B"] };
  assert.deepEqual(parseGradeCommand("masukkan nilai UTS Matematika", multiClass), {
    status: "ask",
    missing: "className",
    question: "Nilai kelas berapa, Bu?",
  });
  assert.equal(parseGradeCommand("masukkan nilai Matematika 4B", BU_SITI).status, "ask");
  // A class she named that isn't hers is asked about, not swapped for her only class.
  assert.equal(parseGradeCommand("masukkan nilai UTS Matematika 4A", BU_SITI).status, "ask");
});

test("asking to be taught starts the grade fill in cara 2 (F1-11)", () => {
  assert.deepEqual(parseGradeCommand("Ajari saya ngisi nilai UTS Matematika 4B", BU_SITI), {
    status: "ok",
    className: "4B",
    subject: "Matematika",
    assessment: "UTS",
    cara: 2,
  });
  assert.deepEqual(routeCommand("Ajari saya ngisi nilai sendiri, ya."), {
    kind: "intent",
    intent: "input_nilai",
    processName: null,
  });
});
