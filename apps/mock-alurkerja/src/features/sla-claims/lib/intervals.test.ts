import { describe, expect, test } from "vite-plus/test";

import { mergedMinutes } from "./intervals";

describe("mergedMinutes", () => {
  test("counts overlapping reports of one outage once", () => {
    expect(
      mergedMinutes([
        { start: "2026-09-21T13:00:00+07:00", end: "2026-09-21T16:30:00+07:00" },
        { start: "2026-09-03T18:00:00+07:00", end: "2026-09-03T22:00:00+07:00" },
        { start: "2026-09-03T08:00:00+07:00", end: "2026-09-03T20:00:00+07:00" },
      ]),
    ).toBe(1_050);
  });

  test("is zero without intervals", () => {
    expect(mergedMinutes([])).toBe(0);
  });
});
