import { describe, expect, test } from "vite-plus/test";

import { isUnclear, unclearSpeech } from "./unclear-speech";

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

describe("unclearSpeech", () => {
  test("says sorry, quotes what Nemu caught and how to try again with the school's keys", () => {
    expect(unclearSpeech(" nilai ", "Bu", "Ctrl + Spasi")).toEqual({
      status: { text: "Belum jelas", tone: "danger" },
      sentence: "Maaf, Bu. Nemu belum dengar jelas.",
      detail: 'Terdengar: "nilai". Tahan Ctrl + Spasi lagi, lalu ulangi lebih dekat.',
    });
  });

  test("without an honorific it still says sorry, with another combination", () => {
    const { sentence, detail } = unclearSpeech("eh", "", "Alt + N");
    expect(sentence).toBe("Maaf. Nemu belum dengar jelas.");
    expect(detail).toBe('Terdengar: "eh". Tahan Alt + N lagi, lalu ulangi lebih dekat.');
  });
});
