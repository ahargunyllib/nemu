import type { VerificationQuestion } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import {
  questionChoices,
  replyFromChoice,
  replyFromNumber,
  replyFromSpeech,
  spokenNumber,
} from "./answers";

const DIGIT: VerificationQuestion = {
  id: "cell-3-c1",
  kind: "digit",
  line: 3,
  column: "c1",
  studentName: "Alya Nur Fitri",
  prompt: "Nilai Alya Nur Fitri: 86 atau 88?",
  options: ["86", "88"],
  box: [600, 150, 700, 170],
};
const NAME: VerificationQuestion = {
  id: "name-2",
  kind: "name",
  line: 2,
  nameRaw: "Aisah Zahra",
  prompt: '"Aisah Zahra" di buku itu siapa?',
  options: [
    { studentId: "s-2", name: "Aisyah Zahra", score: 0.96 },
    { studentId: "s-10", name: "Farah Annisa", score: 0.74 },
  ],
  box: null,
};
const ABSENCE: VerificationQuestion = {
  id: "cell-21-c1",
  kind: "absence",
  line: 21,
  column: "c1",
  studentName: "Putra Wijaya",
  code: "S",
  prompt: "Putra Wijaya: S (sakit). Nilai dikosongkan?",
  options: ["Kosongkan"],
  box: null,
};

describe("W5 choices (F1-06)", () => {
  test("a digit offers its readings in order, then Angka lain; nothing is pre-selected", () => {
    const choices = questionChoices(DIGIT);
    expect(choices.map((choice) => choice.label)).toEqual(["86", "88", "Angka lain"]);
    expect(replyFromChoice(choices[1].id)).toEqual({ answer: "88" });
    expect(replyFromChoice(choices[2]!.id)).toEqual({ other: true });
  });

  test("never more than three buttons; Angka lain always stays", () => {
    const many = questionChoices({ ...DIGIT, options: ["61", "67", "71"] });
    expect(many.map((choice) => choice.label)).toEqual(["61", "67", "Angka lain"]);
    const none = questionChoices({ ...DIGIT, options: [] });
    expect(none.map((choice) => choice.label)).toEqual(["Angka lain", "Kosongkan"]);
    expect(replyFromChoice(none[1].id)).toEqual({ answer: "blank" });
  });

  test("a name offers the roster's names and Tidak ada di daftar; S offers Kosongkan", () => {
    const names = questionChoices(NAME);
    expect(names.map((choice) => choice.label)).toEqual([
      "Aisyah Zahra",
      "Farah Annisa",
      "Tidak ada di daftar",
    ]);
    expect(replyFromChoice(names[0].id)).toEqual({ answer: "s-2" });
    expect(replyFromChoice(names[2]!.id)).toEqual({ answer: "none" });
    expect(questionChoices(ABSENCE).map((choice) => choice.label)).toEqual([
      "Kosongkan",
      "Angka lain",
    ]);
  });
});

describe("answers by voice or the type box", () => {
  test("reads grades said as digits or Indonesian words, 0 to 100", () => {
    expect(spokenNumber("86")).toBe(86);
    expect(spokenNumber("nilainya delapan puluh enam")).toBe(86);
    expect(spokenNumber("tujuh puluh satu, Nemu")).toBe(71);
    expect(spokenNumber("sembilan belas")).toBe(19);
    expect(spokenNumber("sepuluh")).toBe(10);
    expect(spokenNumber("seratus")).toBe(100);
    expect(spokenNumber("lima")).toBe(5);
    expect(spokenNumber("120")).toBeNull();
    expect(spokenNumber("belum tahu")).toBeNull();
  });

  test("a digit question takes a number, Kosongkan or Angka lain", () => {
    expect(replyFromSpeech(DIGIT, "delapan puluh delapan")).toEqual({ answer: "88" });
    expect(replyFromSpeech(DIGIT, "kosongkan saja")).toEqual({ answer: "blank" });
    expect(replyFromSpeech(DIGIT, "angka lain")).toEqual({ other: true });
    expect(replyFromSpeech(DIGIT, "hmm")).toBeNull();
  });

  test("a name question takes a name on its list, or 'tidak ada'", () => {
    expect(replyFromSpeech(NAME, "Aisyah Zahra")).toEqual({ answer: "s-2" });
    expect(replyFromSpeech(NAME, "itu Farah")).toEqual({ answer: "s-10" });
    expect(replyFromSpeech(NAME, "tidak ada di daftar")).toEqual({ answer: "none" });
    expect(replyFromSpeech(NAME, "Budi")).toBeNull();
  });

  test("S takes Kosongkan or the grade written later", () => {
    expect(replyFromSpeech(ABSENCE, "kosongkan")).toEqual({ answer: "Kosongkan" });
    expect(replyFromSpeech(ABSENCE, "75")).toEqual({ answer: "75" });
    expect(replyFromNumber("tujuh puluh lima")).toEqual({ answer: "75" });
    expect(replyFromNumber("entah")).toBeNull();
  });
});
