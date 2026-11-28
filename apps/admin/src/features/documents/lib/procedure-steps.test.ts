import { describe, expect, test } from "vite-plus/test";

import { stepParameters } from "./procedure-steps";

describe("stepParameters", () => {
  test("names each parameter a recorded value is made of", () => {
    expect(stepParameters("{{kelas}}")).toEqual(["kelas"]);
    expect(stepParameters("{{mapel}} {{jenis_penilaian}}")).toEqual(["mapel", "jenis_penilaian"]);
  });

  test("a literal value or a click has none", () => {
    expect(stepParameters("Ujian Juz 30")).toEqual([]);
    expect(stepParameters(null)).toEqual([]);
  });
});
