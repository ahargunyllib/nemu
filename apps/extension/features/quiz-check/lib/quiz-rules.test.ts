import type { QuizQuestion, QuizSnapshot } from "@nemu/contracts/quiz";
import { describe, expect, test } from "vite-plus/test";

import { checkQuiz, classIn } from "./quiz-rules";

const question = (slot: number, change: Partial<QuizQuestion> = {}): QuizQuestion => ({
  slot,
  name: `Soal ${String(slot).padStart(2, "0")}`,
  text: "…",
  hasKey: true,
  images: [],
  ...change,
});

/** The F4-1 quiz as Nemu reads it: soal 07 without a key, soal 15 without timbangan-3.png. */
function f41(change: Partial<QuizSnapshot> = {}): QuizSnapshot {
  return {
    name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
    course: "4A-UJI · Kelas 4A (uji)",
    section: "IPAS",
    opens: "2026-12-02T07:00",
    closes: "2026-12-04T21:00",
    maxGrade: 100,
    listed: 15,
    questions: Array.from({ length: 15 }, (_, index) => {
      const slot = index + 1;
      if (slot === 7) return question(7, { hasKey: false });
      if (slot === 15)
        return question(15, {
          images: [
            { alt: "Gambar (1)", loaded: true },
            { alt: "Gambar (2)", loaded: true },
            { alt: "Gambar (3)", loaded: false },
          ],
        });
      return question(slot);
    }),
    ...change,
  };
}

const BEFORE_TEST = {
  now: new Date(2026, 11, 1, 9, 0),
  honorific: "Bu",
  utterance: "Nemu, tolong cek kuis ini.",
};

describe("checkQuiz (F4-01 DOM rules)", () => {
  test("F4-1: exactly the two planted problems, each as one sentence", () => {
    expect(checkQuiz(f41(), BEFORE_TEST)).toEqual([
      { kind: "no_key", slot: 7, sentence: "Soal 7 belum ada kunci jawabannya, Bu." },
      { kind: "missing_image", slot: 15, sentence: "Soal 15 belum ada gambarnya, Bu." },
    ]);
  });

  test("without a known honorific the sentence just ends", () => {
    expect(checkQuiz(f41(), { ...BEFORE_TEST, honorific: "" })[1]?.sentence).toBe(
      "Soal 15 belum ada gambarnya.",
    );
  });

  test("question count: none, a different number for students, or not what she asked for", () => {
    const clean = f41({ questions: f41().questions.map((item) => question(item.slot)) });
    expect(checkQuiz({ ...clean, listed: 0, questions: [] }, BEFORE_TEST)).toEqual([
      { kind: "question_count", slot: null, sentence: "Kuis ini belum punya soal, Bu." },
    ]);
    expect(
      checkQuiz({ ...clean, questions: clean.questions.slice(0, 14) }, BEFORE_TEST)[0]?.sentence,
    ).toBe("Siswa melihat 14 soal, padahal di halaman Soal ada 15, Bu.");
    expect(
      checkQuiz(clean, { ...BEFORE_TEST, utterance: "cek kuis ini, harusnya 20 soal" })[0]
        ?.sentence,
    ).toBe("Kuis ini berisi 15 soal, bukan 20, Bu.");
    expect(checkQuiz(clean, { ...BEFORE_TEST, utterance: "cek kuis 15 soal ini" })).toEqual([]);
  });

  test("class: the name or her words name another class than the course", () => {
    const clean = f41({ questions: [question(1)], listed: 1 });
    expect(checkQuiz({ ...clean, name: "Kuis IPAS 4B: Energi" }, BEFORE_TEST)[0]?.sentence).toBe(
      "Nama kuis menyebut kelas 4B, tapi kuisnya ada di kelas 4A, Bu.",
    );
    expect(checkQuiz(clean, { ...BEFORE_TEST, utterance: "cek kuis IPAS 4B" })[0]?.sentence).toBe(
      "Kuis ini ada di kelas 4A, bukan 4B, Bu.",
    );
    expect(classIn("4A-UJI · Kelas 4A (uji)")).toBe("4A");
    expect(classIn("Kuis IPAS: Energi")).toBeNull();
  });

  test("times: closing before it opens, or already closed", () => {
    const clean = f41({ questions: [question(1)], listed: 1 });
    expect(checkQuiz({ ...clean, closes: "2026-12-01T21:00" }, BEFORE_TEST)[0]?.sentence).toBe(
      "Waktu tutup kuis ini lebih awal dari waktu bukanya, Bu.",
    );
    const after = { ...BEFORE_TEST, now: new Date(2026, 11, 5, 8, 0) };
    expect(checkQuiz(clean, after)[0]?.sentence).toBe(
      "Kuis ini sudah ditutup 4 Desember 2026, 21.00, jadi siswa tidak bisa mengerjakannya, Bu.",
    );
    expect(checkQuiz({ ...clean, opens: null, closes: null }, after)).toEqual([]);
  });
});
