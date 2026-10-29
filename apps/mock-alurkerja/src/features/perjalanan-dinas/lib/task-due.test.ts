import { describe, expect, it } from "vite-plus/test";

import { daysUntil, matchesDueFilter } from "./task-due";

describe("daysUntil", () => {
  it("is 0 on the day, positive before it, and negative after it", () => {
    expect(daysUntil("2026-11-12", "2026-11-12")).toBe(0);
    expect(daysUntil("2026-11-12", "2026-11-06")).toBe(6);
    expect(daysUntil("2026-11-05", "2026-11-06")).toBe(-1);
  });
});

describe("matchesDueFilter", () => {
  it("sorts late, today, and later Tasks into their filters, and Semua tugas takes every one", () => {
    const filtersOf = (daysLeft: number) =>
      (["Terlambat", "Hari ini", "Mendatang", "Semua tugas"] as const).filter((filter) =>
        matchesDueFilter(filter, daysLeft),
      );
    expect(filtersOf(-1)).toEqual(["Terlambat", "Semua tugas"]);
    expect(filtersOf(0)).toEqual(["Hari ini", "Semua tugas"]);
    expect(filtersOf(2)).toEqual(["Mendatang", "Semua tugas"]);
  });
});
