import type { QuizQuestion, QuizSnapshot } from "@nemu/contracts/quiz";
import { describe, expect, test } from "vite-plus/test";

import { checkQuiz, classIn, reportTitle, verifiedLine } from "./quiz-rules";

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
  test("F4-1: exactly the two planted problems, the missing image first (F4-1_kunci.csv's order)", () => {
    expect(checkQuiz(f41(), BEFORE_TEST)).toEqual([
      {
        kind: "missing_image",
        slot: 15,
        sentence: "Soal 15 belum ada gambarnya, Bu.",
        why: "Di pratinjau, Gambar (3) tidak tampil. Siswa hanya melihat tempatnya kosong.",
        item: "Soal 15: gambar (3) belum ada.",
      },
      {
        kind: "no_key",
        slot: 7,
        sentence: "Soal 7 belum ada kunci jawabannya, Bu.",
        detail: "Ibu isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.",
        why: "Semua pilihan di Soal 7 bernilai 0, jadi siswa yang menjawab benar pun mendapat 0.",
        item: "Soal 7: belum ada kunci jawaban.",
      },
    ]);
  });

  test("every missing image comes before every missing key, each by question number", () => {
    const quiz = f41({
      questions: [
        question(2, { hasKey: false }),
        question(9, { images: [{ alt: "", loaded: false }] }),
        question(4, { hasKey: false, images: [{ alt: "Peta", loaded: false }] }),
      ],
      listed: 3,
    });
    expect(checkQuiz(quiz, BEFORE_TEST).map(({ kind, slot }) => `${kind} ${slot}`)).toEqual([
      "missing_image 4",
      "missing_image 9",
      "no_key 2",
      "no_key 4",
    ]);
  });

  test("Kenapa? names the images by their alt text, or counts them when one has none", () => {
    const why = (images: QuizQuestion["images"]) =>
      checkQuiz(f41({ questions: [question(1, { images })], listed: 1 }), BEFORE_TEST)[0]?.why;
    expect(
      why([
        { alt: "Gambar (2)", loaded: false },
        { alt: "Gambar (3)", loaded: false },
      ]),
    ).toBe(
      "Di pratinjau, Gambar (2) dan Gambar (3) tidak tampil. Siswa hanya melihat tempatnya kosong.",
    );
    expect(why([{ alt: "", loaded: false }])).toBe(
      "Di pratinjau, gambar di soal ini tidak tampil. Siswa hanya melihat tempatnya kosong.",
    );
    expect(
      why([
        { alt: "", loaded: false },
        { alt: "Peta", loaded: false },
      ]),
    ).toBe(
      "Di pratinjau, dua gambar di soal ini tidak tampil. Siswa hanya melihat tempatnya kosong.",
    );
  });

  test("without a known honorific the sentence just ends", () => {
    const problems = checkQuiz(f41(), { ...BEFORE_TEST, honorific: "" });
    expect(problems[0]?.sentence).toBe("Soal 15 belum ada gambarnya.");
    expect(problems[1]).toMatchObject({
      sentence: "Soal 7 belum ada kunci jawabannya.",
      detail: "Isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.",
    });
  });

  test("a question with no key points to Edit soal and never proposes a key (PRD v2.3)", () => {
    const noKey = checkQuiz(f41(), { ...BEFORE_TEST, honorific: "Pak" }).find(
      (problem) => problem.kind === "no_key",
    );
    // The sentence is the official key's; where to fill it is the detail line under it.
    expect(noKey?.sentence).toBe("Soal 7 belum ada kunci jawabannya, Pak.");
    expect(noKey?.detail).toBe("Bapak isi kuncinya lewat Edit soal. Nemu tidak mengubahnya.");
    expect(`${noKey?.sentence} ${noKey?.detail}`).not.toMatch(/\?/u);
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

describe("the report after the last problem (#256, F4·05)", () => {
  test("F4-1: the official key's example sentence, what the check found right, one line each", () => {
    const problems = checkQuiz(f41(), BEFORE_TEST);
    // F4-1_kunci.csv row 4: “Ada 2 hal yang perlu Ibu perbaiki: soal 15 dan soal 7.”
    expect(reportTitle(problems, "Bu")).toBe(
      "Ada 2 hal yang perlu Ibu perbaiki: soal 15 dan soal 7.",
    );
    expect(verifiedLine(f41(), problems)).toBe(
      "Yang lain sudah benar: 15 soal, kelas 4A, buka Rabu 2 Des 07.00.",
    );
    expect(problems.map((problem) => problem.item)).toEqual([
      "Soal 15: gambar (3) belum ada.",
      "Soal 7: belum ada kunci jawaban.",
    ]);
  });

  test("fits the teacher and the count; a problem about the whole quiz is named by its part", () => {
    const one = checkQuiz(f41({ questions: [question(3, { hasKey: false })], listed: 1 }), {
      ...BEFORE_TEST,
      honorific: "Pak",
    });
    expect(reportTitle(one, "Pak")).toBe("Ada 1 hal yang perlu Bapak perbaiki: soal 3.");
    const quizWide = checkQuiz(
      f41({ name: "Kuis IPAS 4B", questions: [], listed: 0 }),
      BEFORE_TEST,
    );
    expect(reportTitle(quizWide, "")).toBe(
      "Ada 2 hal yang perlu diperbaiki: jumlah soal dan kelas.",
    );
  });

  test("a missing image without alt text is just “gambarnya”", () => {
    const [problem] = checkQuiz(
      f41({ questions: [question(4, { images: [{ alt: "", loaded: false }] })], listed: 1 }),
      BEFORE_TEST,
    );
    expect(problem?.item).toBe("Soal 4: gambarnya belum ada.");
  });

  test("claims only what was checked and found right", () => {
    const quiz = f41({ name: "Kuis IPAS 4B", closes: "2026-12-01T21:00" });
    // The class and the times have a problem; the count is still right.
    expect(verifiedLine(quiz, checkQuiz(quiz, BEFORE_TEST))).toBe(
      "Yang lain sudah benar: 15 soal.",
    );
    // No open time set: it isn't claimed.
    expect(verifiedLine(f41({ opens: null }), [])).toBe(
      "Yang lain sudah benar: 15 soal, kelas 4A.",
    );
    const empty = f41({ course: "IPAS", opens: null, listed: 0, questions: [] });
    expect(verifiedLine(empty, checkQuiz(empty, BEFORE_TEST))).toBeNull();
  });
});
