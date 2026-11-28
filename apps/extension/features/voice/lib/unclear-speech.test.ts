import { describe, expect, test } from "vite-plus/test";

import { isUnclear, unclearMessage } from "./unclear-speech";

describe("isUnclear", () => {
  test.each([
    "masukkan nilai UTS Matematika 4B",
    "Nemu, ini kenapa?",
    "Nemu iki kenopo",
    "KKM berapa?",
    "isi nilai",
    "Nemu, nilaine Aisyah kok ora metu.",
  ])("a question or a request is clear: %s", (utterance) => {
    expect(isUnclear(utterance)).toBe(false);
  });

  test.each(["lanjut", "Nemu, tolong ulangi ya.", "stop"])(
    "a short command is clear: %s",
    (utterance) => {
      expect(isUnclear(utterance)).toBe(false);
    },
  );

  test.each(["", "eh", "Hmm…", "a", "apa?", "nilai", "Kelas 4B", "ya, Nemu"])(
    "a mumble, one stray word or two without a request is unclear: %s",
    (utterance) => {
      expect(isUnclear(utterance)).toBe(true);
    },
  );
});

describe("unclearMessage", () => {
  test("quotes what Nemu caught and asks the teacher to say it again", () => {
    expect(unclearMessage("nilai", "Bu")).toBe("Nemu menangkap: “nilai”. Bisa diulang, Bu?");
  });

  test("without an honorific it still asks", () => {
    expect(unclearMessage("eh", "")).toBe("Nemu menangkap: “eh”. Bisa diulang?");
  });
});
