import {
  type AjukanPerjalananDinasInput,
  ajukanPerjalananDinasInputSchema,
} from "@nemu/contracts/process-instance";
import z from "zod";

// The form holds what the inputs hold (text, a picked file); Kirim converts it to the wire input.
export const PERDIN_FORM_DEFAULTS = {
  jenisPerjalanan: "",
  nomorSuratTugas: "",
  kotaTujuan: "",
  maksud: "",
  tanggalBerangkat: "",
  tanggalKembali: "",
  modaTransport: "",
  biayaTransport: "",
  penginapan: "",
  nominalPenginapan: "",
  uangHarian: "",
  dokumenUndangan: null as File | null,
};

export type PerdinFormValues = typeof PERDIN_FORM_DEFAULTS;

/** File name of the sample undangan in `sample-documents/`; only the name is sent. */
export const DEMO_UNDANGAN_FILE_NAME = "undangan-rapat-koordinasi.pdf";

/**
 * What "Isi formulir demo" types in: Rina's trip to Makassar on 3–5 November 2026. Penginapan and
 * nominal penginapan stay empty, because in Momen 2 Rina asks Nemu how to fill them in.
 */
export const PERDIN_FORM_DEMO_VALUES = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  nomorSuratTugas: "ST-123/BLD/2026",
  kotaTujuan: "Makassar",
  maksud: "Rapat koordinasi layanan digital",
  tanggalBerangkat: "2026-11-03",
  tanggalKembali: "2026-11-05",
  modaTransport: "Pesawat",
  biayaTransport: "3500000",
  uangHarian: "1290000",
} satisfies Partial<PerdinFormValues>;

const wajib = (message: string) => z.string().trim().min(1, { message, abort: true });
const rupiah = (message: string) =>
  wajib(message).regex(/^\d+$/, "Isi dengan angka tanpa titik atau koma");

export const perdinFormSchema = z
  .object({
    jenisPerjalanan: wajib("Pilih jenis perjalanan"),
    nomorSuratTugas: wajib("Isi nomor surat tugas"),
    kotaTujuan: wajib("Pilih kota tujuan"),
    maksud: wajib("Isi maksud perjalanan"),
    tanggalBerangkat: wajib("Isi tanggal berangkat"),
    tanggalKembali: wajib("Isi tanggal kembali"),
    modaTransport: wajib("Pilih moda transportasi"),
    biayaTransport: rupiah("Isi biaya transportasi"),
    penginapan: wajib("Pilih jenis penginapan"),
    nominalPenginapan: rupiah("Isi nominal penginapan"),
    uangHarian: rupiah("Isi uang harian"),
    dokumenUndangan: z
      .instanceof(File)
      .nullable()
      .refine((file) => file !== null, "Unggah undangan"),
  })
  .refine(
    (values) =>
      !values.tanggalBerangkat ||
      !values.tanggalKembali ||
      values.tanggalKembali >= values.tanggalBerangkat,
    { path: ["tanggalKembali"], message: "Tanggal kembali tidak boleh sebelum tanggal berangkat" },
  );

export function toAjukanPerjalananDinasInput(values: PerdinFormValues): AjukanPerjalananDinasInput {
  return ajukanPerjalananDinasInputSchema.parse({
    ...values,
    biayaTransport: Number(values.biayaTransport),
    nominalPenginapan: Number(values.nominalPenginapan),
    uangHarian: Number(values.uangHarian),
    dokumenUndangan: values.dokumenUndangan?.name ?? "",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trip length shown under Jadwal, e.g. 3–5 November is 3 hari and 2 malam. */
export function lamaPerjalanan(
  tanggalBerangkat: string,
  tanggalKembali: string,
): { hari: number; malam: number } | null {
  if (!tanggalBerangkat || !tanggalKembali || tanggalKembali < tanggalBerangkat) return null;
  const malam = Math.round(
    (Date.parse(`${tanggalKembali}T00:00:00Z`) - Date.parse(`${tanggalBerangkat}T00:00:00Z`)) /
      DAY_MS,
  );
  return { hari: malam + 1, malam };
}
