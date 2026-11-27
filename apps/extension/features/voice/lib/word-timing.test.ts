import { describe, expect, test } from "vite-plus/test";

import {
  estimateWords,
  mainSentence,
  rescaleWords,
  spokenWordIn,
  withSpokenWord,
  wordIndexAt,
} from "./word-timing";

const words = [
  { text: "Silakan", offsetMs: 0, durationMs: 400 },
  { text: "tekan", offsetMs: 500, durationMs: 300 },
  { text: "Simpan.", offsetMs: 900, durationMs: 500 },
];

describe("rescaleWords", () => {
  test("stretches estimated timings to the real audio length", () => {
    expect(rescaleWords(words, 1_400, 2_800)).toEqual([
      { text: "Silakan", offsetMs: 0, durationMs: 800 },
      { text: "tekan", offsetMs: 1_000, durationMs: 600 },
      { text: "Simpan.", offsetMs: 1_800, durationMs: 1_000 },
    ]);
  });

  test("keeps the timings when either length is unknown", () => {
    expect(rescaleWords(words, 0, 2_800)).toEqual(words);
    expect(rescaleWords(words, 1_400, Number.NaN)).toEqual(words);
    expect(rescaleWords(words, 1_400, Number.POSITIVE_INFINITY)).toEqual(words);
  });
});

describe("wordIndexAt", () => {
  test("follows the spoken word and holds it through the pause after", () => {
    expect(wordIndexAt(words, 0)).toBe(0);
    expect(wordIndexAt(words, 450)).toBe(0);
    expect(wordIndexAt(words, 500)).toBe(1);
    expect(wordIndexAt(words, 1_399)).toBe(2);
  });

  test("highlights nothing once the sentence ends, or without words", () => {
    expect(wordIndexAt(words, 1_400)).toBe(-1);
    expect(wordIndexAt([], 0)).toBe(-1);
  });
});

describe("mainSentence", () => {
  test("speaks the first sentence of the bubble", () => {
    expect(
      mainSentence("KKM seluruh mata pelajaran adalah 75. Nilai di bawahnya ikut remedial."),
    ).toBe("KKM seluruh mata pelajaran adalah 75.");
  });

  test("keeps a decimal inside the sentence and a text without a full stop", () => {
    expect(mainSentence("Bobot UTS 0.4 dari nilai akhir")).toBe("Bobot UTS 0.4 dari nilai akhir");
  });

  test("cuts a long sentence at a word under the synthesis limit", () => {
    const sentence = mainSentence(`${"kata ".repeat(80)}akhir.`);
    expect(sentence.length).toBeLessThanOrEqual(300);
    expect(sentence.endsWith("kata")).toBe(true);
  });
});

describe("estimateWords", () => {
  test("times one word after another with a longer pause after a comma", () => {
    const { words: estimated, durationMs } = estimateWords("Ya, tekan Simpan.");
    expect(estimated.map((word) => word.text)).toEqual(["Ya,", "tekan", "Simpan."]);
    expect(estimated[1]!.offsetMs).toBe(240 + 180);
    expect(durationMs).toBeGreaterThan(estimated[2]!.offsetMs + estimated[2]!.durationMs);
  });
});

describe("spokenWordIn", () => {
  const answer = "KKM seluruh mata pelajaran adalah 75. Nilai di bawahnya ikut remedial.";
  const sentence = "KKM seluruh mata pelajaran adalah 75.";

  test("marks the voice's word while it reads this bubble's sentence", () => {
    expect(spokenWordIn(answer, { sentence, activeIndex: 3 })).toBe(3);
  });

  test("marks nothing between words, before the voice starts, or for another sentence", () => {
    expect(spokenWordIn(answer, { sentence, activeIndex: -1 })).toBeUndefined();
    expect(spokenWordIn(answer, null)).toBeUndefined();
    expect(
      spokenWordIn(answer, { sentence: "Sumber: SOP Penilaian.", activeIndex: 0 }),
    ).toBeUndefined();
  });
});

describe("withSpokenWord", () => {
  test("marks the word in a bubble a flow speaks itself; a Kartu Pilih stays as it is", () => {
    const voice = { sentence: "Nilai kelas berapa, Bu?", activeIndex: 1 };
    expect(withSpokenWord({ type: "jawab", sentence: "Nilai kelas berapa, Bu?" }, voice)).toEqual({
      type: "jawab",
      sentence: "Nilai kelas berapa, Bu?",
      highlightedWord: 1,
    });
    const card = { type: "pilih", question: "Nilai kelas berapa, Bu?" };
    expect(withSpokenWord(card, voice)).toBe(card);
  });
});
