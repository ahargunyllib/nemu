import { describe, expect, it } from "vite-plus/test";

import {
  DEMO_UNDANGAN_FILE_NAME,
  PERDIN_FORM_DEFAULTS,
  PERDIN_FORM_DEMO_VALUES,
  PERDIN_TABS,
  type PerdinFormValues,
  lamaPerjalanan,
  perdinFormSchema,
  shownPerdinErrors,
  tabsWithErrors,
  toAjukanPerjalananDinasInput,
} from "./perdin-form";

const filled: PerdinFormValues = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  kotaTujuan: "Makassar",
  dasarPenugasan: "ST-090/2026",
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
  it("blocks Start Process on an empty form with an error on every field", () => {
    const result = perdinFormSchema.safeParse(PERDIN_FORM_DEFAULTS);

    const invalidFields = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect(invalidFields).toEqual(new Set(Object.keys(PERDIN_FORM_DEFAULTS)));
  });

  it("blocks Start Process when any single field is left empty", () => {
    for (const field of Object.keys(PERDIN_FORM_DEFAULTS) as (keyof PerdinFormValues)[]) {
      const result = perdinFormSchema.safeParse({
        ...filled,
        [field]: PERDIN_FORM_DEFAULTS[field],
      });
      expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([field]);
    }
  });

  it("rejects a destination the Demo App does not offer", () => {
    const result = perdinFormSchema.safeParse({ ...filled, kotaTujuan: "Kupang" });

    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["kotaTujuan"]);
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

describe("PERDIN_TABS", () => {
  it("puts every field on exactly one tab, so each error has a tab to show on", () => {
    const fields = PERDIN_TABS.flatMap((tab) => tab.fields);

    expect([...fields].sort()).toEqual(Object.keys(PERDIN_FORM_DEFAULTS).sort());
  });
});

describe("shownPerdinErrors", () => {
  const values = { ...filled, maksud: "", nominalPenginapan: "447.000" };

  it("shows errors only on touched fields before a send is tried", () => {
    expect(
      shownPerdinErrors(
        values,
        { maksud: { isTouched: false }, nominalPenginapan: { isTouched: true } },
        false,
      ),
    ).toEqual({ nominalPenginapan: "Isi dengan angka tanpa titik atau koma" });
  });

  it("shows every error once a send was tried", () => {
    expect(Object.keys(shownPerdinErrors(values, {}, true)).sort()).toEqual([
      "maksud",
      "nominalPenginapan",
    ]);
  });
});

describe("tabsWithErrors", () => {
  it("marks only the tabs holding a field with an error", () => {
    expect(
      tabsWithErrors({ tanggalKembali: "Pilih tanggal kembali", uangHarian: "Isi uang harian" }),
    ).toEqual(["jadwal", "biaya"]);
  });
});

describe("PERDIN_FORM_DEMO_VALUES", () => {
  it("leaves only the Momen 2 lodging fields for Rina to fill in", () => {
    const result = perdinFormSchema.safeParse({
      ...PERDIN_FORM_DEFAULTS,
      ...PERDIN_FORM_DEMO_VALUES,
      dokumenUndangan: new File(["%PDF-1.7"], DEMO_UNDANGAN_FILE_NAME),
    });

    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "penginapan",
      "nominalPenginapan",
    ]);
  });
});

describe("toAjukanPerjalananDinasInput", () => {
  it("sends the picked surat tugas as the nomor surat tugas", () => {
    expect(toAjukanPerjalananDinasInput(filled).nomorSuratTugas).toBe("ST-090/2026");
  });

  it("sends a typed destination as the Demo App city", () => {
    expect(toAjukanPerjalananDinasInput({ ...filled, kotaTujuan: " makassar " }).kotaTujuan).toBe(
      "Makassar",
    );
  });

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
