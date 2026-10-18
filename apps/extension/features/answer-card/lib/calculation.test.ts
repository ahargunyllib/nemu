import { momentThreeResponse, momentTwoResponse } from "@nemu/contracts/fixtures";
import { describe, expect, test } from "vite-plus/test";

import { copyableValue, describeCalculation } from "./calculation";

describe("describeCalculation", () => {
  test("shows the Momen 2 lodging lumpsum as percentage × rate × nights", () => {
    expect(momentTwoResponse.calc.map(describeCalculation)).toEqual([
      {
        title: "Lumpsum penginapan",
        formula: "30% × Rp745.000 × 2 malam",
        result: "Rp447.000",
        source: "SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III",
      },
    ]);
  });

  test("shows the Momen 3 deadline as working days after the return date", () => {
    expect(momentThreeResponse.calc.map(describeCalculation)).toEqual([
      {
        title: "Batas Pertanggungjawaban",
        formula: "5 hari kerja setelah 5 November 2026",
        result: "12 November 2026",
        source: undefined,
      },
    ]);
  });

  test("falls back to listing every input when the shape is unfamiliar", () => {
    expect(
      describeCalculation({
        fungsi: "lookup_sbm",
        input: { provinsi: "Sulawesi Selatan", golongan: "III" },
        hasil: 745_000,
      }),
    ).toEqual({
      title: "Tarif SBM",
      formula: "provinsi: Sulawesi Selatan, golongan: III",
      result: "745.000",
      source: undefined,
    });
  });
});

describe("copyableValue", () => {
  test("offers the Momen 2 lodging lumpsum as Rupiah, copied as digits", () => {
    expect(copyableValue(momentTwoResponse.calc)).toEqual({ label: "Rp447.000", text: "447000" });
  });

  test("offers nothing for a date, such as the Momen 3 deadline", () => {
    expect(copyableValue(momentThreeResponse.calc)).toBeUndefined();
  });
});
