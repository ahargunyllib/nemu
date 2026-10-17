import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type AjukanPerjalananDinasInput,
  ajukanPerjalananDinasInputSchema,
  unggahDokumenInputSchema,
} from "./process-instance.js";

const rinaToMakassar: AjukanPerjalananDinasInput = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  nomorSuratTugas: "ST-123/BLD/2026",
  kotaTujuan: "Makassar",
  maksud: "Rapat koordinasi layanan digital",
  tanggalBerangkat: "2026-11-03",
  tanggalKembali: "2026-11-05",
  modaTransport: "Pesawat",
  biayaTransport: 3_500_000,
  penginapan: "tidak_hotel",
  nominalPenginapan: 447_000,
  uangHarian: 1_290_000,
  dokumenUndangan: "undangan-rapat.pdf",
};

test("a fully filled Ajukan Perjalanan Dinas form is accepted", () => {
  assert.ok(ajukanPerjalananDinasInputSchema.safeParse(rinaToMakassar).success);
});

test("every text field is required: a blank one is rejected", () => {
  for (const field of ["nomorSuratTugas", "maksud", "dokumenUndangan"] as const) {
    const result = ajukanPerjalananDinasInputSchema.safeParse({ ...rinaToMakassar, [field]: "  " });
    assert.equal(result.success, false, `${field} accepted a blank value`);
  }
});

test("an option outside the form's choices is rejected", () => {
  const result = ajukanPerjalananDinasInputSchema.safeParse({
    ...rinaToMakassar,
    penginapan: "rumah_saudara",
  });
  assert.equal(result.success, false);
});

test("tanggal kembali before tanggal berangkat is rejected on tanggalKembali", () => {
  const result = ajukanPerjalananDinasInputSchema.safeParse({
    ...rinaToMakassar,
    tanggalKembali: "2026-11-02",
  });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["tanggalKembali"]);
});

test("a Pertanggungjawaban upload names one of the documents the AI knows", () => {
  const upload = { instanceId: "PD-2026-0042", namaFile: "laporan.pdf" };

  assert.ok(unggahDokumenInputSchema.safeParse({ ...upload, jenis: "laporan_perjalanan" }).success);
  assert.ok(!unggahDokumenInputSchema.safeParse({ ...upload, jenis: "kuitansi" }).success);
});
