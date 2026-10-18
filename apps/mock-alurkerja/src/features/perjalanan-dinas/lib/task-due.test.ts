import { describe, expect, it } from "vite-plus/test";

import { daysUntilDue, matchesDueFilter, taskDueDate } from "./task-due";

describe("taskDueDate", () => {
  it("falls a week after the Task opened", () => {
    expect(taskDueDate({ updatedAt: new Date("2026-11-06T03:00:00Z") })).toEqual(
      new Date("2026-11-13T03:00:00Z"),
    );
  });
});

describe("daysUntilDue", () => {
  const due = new Date("2026-11-13T03:00:00Z");

  it("counts whole WIB days, so a later hour on the due day is still 0", () => {
    expect(daysUntilDue(due, new Date("2026-11-13T15:00:00Z"))).toBe(0);
  });

  it("turns the day over at midnight WIB, not UTC", () => {
    // 2026-11-13 18:00Z is already 14 November in Yogyakarta.
    expect(daysUntilDue(due, new Date("2026-11-13T18:00:00Z"))).toBe(-1);
  });

  it("is positive before the due day and negative after it", () => {
    expect(daysUntilDue(due, new Date("2026-11-10T05:00:00Z"))).toBe(3);
    expect(daysUntilDue(due, new Date("2026-11-16T05:00:00Z"))).toBe(-3);
  });
});

describe("matchesDueFilter", () => {
  it("sorts late, today, and later Tasks into their filters, and All Tasks takes every one", () => {
    const filtersOf = (daysLeft: number) =>
      (["Overdue", "Due Today", "Upcoming", "All Tasks"] as const).filter((filter) =>
        matchesDueFilter(filter, daysLeft),
      );
    expect(filtersOf(-1)).toEqual(["Overdue", "All Tasks"]);
    expect(filtersOf(0)).toEqual(["Due Today", "All Tasks"]);
    expect(filtersOf(2)).toEqual(["Upcoming", "All Tasks"]);
  });
});
