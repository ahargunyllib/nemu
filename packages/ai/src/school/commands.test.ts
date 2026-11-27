import assert from "node:assert/strict";
import test from "node:test";

import { matchVoiceControl, parseGradeCommand, routeCommand } from "./commands.js";
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
});
