import { describe, expect, test } from "vite-plus/test";

import {
  addDays,
  type CourseQuiz,
  localDay,
  namedDay,
  parseMoodleDay,
  pickQuiz,
} from "./pick-quiz";

// Kelas 4A (uji) as setup-f4-1.php and setup-f4-3.php leave it.
const IPAS: CourseQuiz = {
  cmid: 2,
  name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
  section: "IPAS",
  opens: "2026-12-02",
  closes: "2026-12-04",
};
const MY_FAMILY: CourseQuiz = {
  cmid: 3,
  name: "Latihan: My Family (has/have)",
  section: "Bahasa Inggris",
  opens: "2026-11-30",
  closes: "2026-12-04",
};
const DECOY: CourseQuiz = {
  cmid: 4,
  name: "Parts of Body + Family (pengecoh)",
  section: "Bahasa Inggris",
  opens: "2026-11-23",
  closes: "2026-11-27",
};
const COURSE = [IPAS, MY_FAMILY, DECOY];
const F4_3 = "Tolong hapus latihan bahasa Inggris yang kemarin.";

describe("pickQuiz (F4-06)", () => {
  test("F4-3 on the test day: 'yang kemarin' is My Family, opened yesterday", () => {
    expect(pickQuiz(COURSE, F4_3, "2026-12-01")).toEqual({ kind: "one", quiz: MY_FAMILY });
    // Later in the week it was still open yesterday; the decoy had closed.
    expect(pickQuiz(COURSE, F4_3, "2026-12-03")).toEqual({ kind: "one", quiz: MY_FAMILY });
  });

  test("when the decoy was the one open yesterday, Nemu asks between the two", () => {
    expect(pickQuiz(COURSE, F4_3, "2026-11-27")).toEqual({
      kind: "ask",
      candidates: [MY_FAMILY, DECOY],
    });
  });

  test("without a day, 'latihan bahasa Inggris' is too close to call", () => {
    const pick = pickQuiz(COURSE, "hapus latihan bahasa Inggris", "2026-12-01");
    expect(pick.kind).toBe("ask");
    expect(pick.kind === "ask" && pick.candidates.map((quiz) => quiz.cmid)).toEqual([3, 4]);
  });

  test("the quiz's own name picks it; another section's quiz never comes up", () => {
    expect(pickQuiz(COURSE, "hapus kuis Parts of Body", "2026-12-01")).toEqual({
      kind: "one",
      quiz: DECOY,
    });
    expect(pickQuiz(COURSE, "hapus kuis IPAS", "2026-12-01")).toEqual({ kind: "one", quiz: IPAS });
  });

  test("words that match no quiz pick nothing; a course with one quiz needs none", () => {
    expect(pickQuiz(COURSE, "hapus kuis matematika", "2026-12-01")).toEqual({ kind: "none" });
    expect(pickQuiz([DECOY], "hapus kuis ini", "2026-12-01")).toEqual({ kind: "one", quiz: DECOY });
    expect(pickQuiz([], F4_3, "2026-12-01")).toEqual({ kind: "none" });
  });
});

describe("dates", () => {
  test("Moodle's shown dates, in Indonesian and English", () => {
    expect(parseMoodleDay("Senin, 30 November 2026, 07.00")).toBe("2026-11-30");
    expect(parseMoodleDay("Jumat, 4 Desember 2026, 21.00")).toBe("2026-12-04");
    expect(parseMoodleDay("Monday, 23 November 2026, 7:00 AM")).toBe("2026-11-23");
    expect(parseMoodleDay("besok")).toBeNull();
  });

  test("days she names, across a month's end", () => {
    expect(addDays("2026-12-01", -1)).toBe("2026-11-30");
    expect(namedDay(F4_3, "2026-12-01")).toBe("2026-11-30");
    expect(namedDay("hapus kuis hari ini", "2026-12-01")).toBe("2026-12-01");
    expect(namedDay("hapus kuis IPAS", "2026-12-01")).toBeNull();
    expect(localDay(new Date(2026, 11, 1, 6, 30))).toBe("2026-12-01");
  });
});
