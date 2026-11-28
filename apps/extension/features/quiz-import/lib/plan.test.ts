import { describe, expect, test } from "vite-plus/test";

import { answerFrom, choicesFor } from "./answers";
import { readySentence, spokenDate, timesInOrder, timesSentence, withDefaults } from "./plan";

describe("F4-03's times (#210)", () => {
  test("dates without a clock time open at 00.00 and close at 23.59, and Nemu says so", () => {
    const times = withDefaults(
      { date: "2026-12-07", time: null },
      { date: "2026-12-10", time: null },
    );
    expect(times).toEqual({
      opens: { date: "2026-12-07", time: "00:00" },
      closes: { date: "2026-12-10", time: "23:59" },
      defaulted: "both",
    });
    expect(timesSentence(times.opens, times.closes, times.defaulted, "Bu")).toBe(
      "Jamnya tidak disebut, jadi kuis dibuka 7 Desember pukul 00.00 dan ditutup 10 Desember pukul 23.59, Bu.",
    );
    expect(spokenDate("2026-12-07")).toBe("Senin, 7 Desember 2026");
    expect(spokenDate("2026-12-10")).toBe("Kamis, 10 Desember 2026");
  });

  test("times she said are kept and not called out; a close before the open is refused", () => {
    const times = withDefaults(
      { date: "2026-12-02", time: "07:00" },
      { date: "2026-12-04", time: "21:00" },
    );
    expect(times.defaulted).toBeNull();
    expect(timesSentence(times.opens, times.closes, null, "Pak")).toBe(
      "Kuis dibuka 2 Desember pukul 07.00 dan ditutup 4 Desember pukul 21.00, Pak.",
    );
    expect(timesInOrder(times.opens, times.closes)).toBe(true);
    expect(timesInOrder(times.closes, times.opens)).toBe(false);
  });

  test("the Sudah dicek title after the F4-1 check finds nothing (F4·11)", () => {
    expect(readySentence(10)).toBe("Kuis terpasang, 10 soal siap.");
  });
});

describe("questions about the script, as Kartu Pilih or her own words", () => {
  const key = {
    id: "key-4",
    kind: "key" as const,
    soal: 4,
    prompt: "Kunci jawaban soal 4 tidak ada di naskah. Yang benar yang mana, Bu?",
    options: ["a", "b", "c"],
  };
  test("a key: three letters on the card, and she may say a fourth", () => {
    expect(choicesFor(key)).toEqual([
      { id: "0", label: "Pilihan a" },
      { id: "1", label: "Pilihan b" },
      { id: "2", label: "Pilihan c" },
    ]);
    expect(answerFrom(key, "Yang d, Nemu.")).toBe("d");
    expect(answerFrom(key, "tidak tahu")).toBeNull();
  });

  test("words she gives are taken as they are; a section must be one of the course's", () => {
    const text = {
      id: "text-2",
      kind: "text" as const,
      soal: 2,
      choice: null,
      prompt: "?",
      options: [],
    };
    expect(choicesFor(text)).toBeNull();
    expect(answerFrom(text, "Contoh gaya otot adalah ....")).toBe("Contoh gaya otot adalah ....");
    const section = {
      id: "section",
      kind: "section" as const,
      prompt: "?",
      options: ["IPAS", "Bahasa Inggris", "Umum"],
    };
    expect(answerFrom(section, "masuk ke IPAS saja")).toBe("IPAS");
    expect(answerFrom(section, "Matematika")).toBeNull();
    const image = {
      id: "image-7-c",
      kind: "image" as const,
      soal: 7,
      choice: 2,
      prompt: "?",
      options: ["Lewati soal ini", "Gambarnya saya pasang nanti"],
    };
    expect(answerFrom(image, "lewati saja")).toBe("Lewati soal ini");
    expect(answerFrom(image, "nanti saya pasang sendiri")).toBe("Gambarnya saya pasang nanti");
  });
});
