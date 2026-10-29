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

  test("labels every SLA claim calculation and formats compensation as rupiah", () => {
    const calculations = [
      { fungsi: "claim_cutoff", input: {}, hasil: "2026-10-15" },
      { fungsi: "merge_claim_intervals", input: {}, hasil: 1_050 },
      {
        fungsi: "sla_compensation",
        input: {
          C_minutes: 43_200,
          sla_basis_points: 9_950,
          Av_minutes: 216,
          A_minutes: 1_050,
          B_idr: 30_000_000,
        },
        hasil: 579_167,
      },
      { fungsi: "claim_approval_route", input: {}, hasil: "Sari → Hendra" },
      { fungsi: "claim_evidence_guard", input: {}, hasil: "PERLU_BUKTI" },
    ] as const;

    expect(calculations.map((calculation) => describeCalculation(calculation))).toMatchObject([
      { title: "Batas pengajuan klaim", result: "15 Oktober 2026" },
      { title: "Durasi gangguan tergabung", result: "1.050" },
      { title: "Kompensasi SLA", result: "Rp579.167" },
      { title: "Rute persetujuan", result: "Sari → Hendra" },
      { title: "Kelengkapan bukti RCA", result: "PERLU_BUKTI" },
    ]);
  });
});

describe("copyableValue", () => {
  test("offers the Momen 2 lodging lumpsum as Rupiah, copied as digits", () => {
    expect(copyableValue(momentTwoResponse.calc)).toEqual({ label: "Rp447.000", text: "447000" });
  });

  test("offers the lodging lumpsum over the SBM rate and daily allowance in the real Momen 2 order", () => {
    expect(
      copyableValue([
        {
          fungsi: "lookup_sbm",
          input: { provinsi: "Sulawesi Selatan", golongan: "III" },
          hasil: 745_000,
        },
        {
          fungsi: "uang_harian",
          input: { provinsi: "Sulawesi Selatan", hari: 3 },
          hasil: 1_290_000,
        },
        ...momentTwoResponse.calc,
      ]),
    ).toEqual({ label: "Rp447.000", text: "447000" });
  });

  test("offers nothing when the only amount is the SBM rate", () => {
    expect(
      copyableValue([
        {
          fungsi: "lookup_sbm",
          input: { provinsi: "Sulawesi Selatan", golongan: "III" },
          hasil: 745_000,
        },
      ]),
    ).toBeUndefined();
  });

  test("offers nothing for a date, such as the Momen 3 deadline", () => {
    expect(copyableValue(momentThreeResponse.calc)).toBeUndefined();
  });
});
