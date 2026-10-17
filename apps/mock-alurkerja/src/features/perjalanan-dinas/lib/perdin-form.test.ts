import { describe, expect, it } from "vite-plus/test";

import {
  PERDIN_FORM_DEFAULTS,
  type PerdinFormValues,
  lamaPerjalanan,
  perdinFormSchema,
  toAjukanPerjalananDinasInput,
} from "./perdin-form";

const filled: PerdinFormValues = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  nomorSuratTugas: "ST-123/BLD/2026",
  kotaTujuan: "Makassar",
  maksud: "Rapat koordinasi layanan digital",
  tanggalBerangkat: "2026-11-03",
  tanggalKembali: "2026-11-05",
  modaTransport: "Pesawat",
  biayaTransport: "3893000",
  penginapan: "tidak_hotel",
  nominalPenginapan: "447000",
  uangHarian: "1290000",
  dokumenUndangan: new File(["%PDF-1.7"], "undangan-rapat.pdf"),
};

describe("perdinFormSchema", () => {
  it("blocks Kirim on an empty form with an error on every field", () => {
    const result = perdinFormSchema.safeParse(PERDIN_FORM_DEFAULTS);

    const invalidFields = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect(invalidFields).toEqual(new Set(Object.keys(PERDIN_FORM_DEFAULTS)));
  });

  it("blocks Kirim when any single field is left empty", () => {
    for (const field of Object.keys(PERDIN_FORM_DEFAULTS) as (keyof PerdinFormValues)[]) {
      const result = perdinFormSchema.safeParse({
        ...filled,
        [field]: PERDIN_FORM_DEFAULTS[field],
      });
      expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([field]);
    }
  });

  it("rejects an amount that is not a plain number", () => {
    const result = perdinFormSchema.safeParse({ ...filled, nominalPenginapan: "447.000" });

    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["nominalPenginapan"]);
  });

  it("rejects a return date before the departure date", () => {
    const result = perdinFormSchema.safeParse({ ...filled, tanggalKembali: "2026-11-01" });

    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["tanggalKembali"]);
  });
});

describe("toAjukanPerjalananDinasInput", () => {
  it("sends amounts as rupiah numbers and the undangan by file name", () => {
    expect(toAjukanPerjalananDinasInput(filled)).toMatchObject({
      kotaTujuan: "Makassar",
      penginapan: "tidak_hotel",
      biayaTransport: 3_893_000,
      nominalPenginapan: 447_000,
      uangHarian: 1_290_000,
      dokumenUndangan: "undangan-rapat.pdf",
    });
  });
});

describe("lamaPerjalanan", () => {
  it("counts 3 hari and 2 malam for 3–5 November", () => {
    expect(lamaPerjalanan("2026-11-03", "2026-11-05")).toEqual({ hari: 3, malam: 2 });
  });

  it("has no length until both dates are valid", () => {
    expect(lamaPerjalanan("2026-11-03", "")).toBeNull();
    expect(lamaPerjalanan("2026-11-05", "2026-11-03")).toBeNull();
  });
});
