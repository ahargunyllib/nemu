import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  type AjukanPerjalananDinasInput,
  JENIS_PERJALANAN,
  KOTA_TUJUAN,
  type KotaTujuan,
  MODA_TRANSPORT,
  ajukanPerjalananDinasInputSchema,
} from "@nemu/contracts/process-instance";
import z from "zod";

// The form holds what the inputs hold (text, a picked file); Mulai Proses converts it to the wire input.
export const PERDIN_FORM_DEFAULTS = {
  jenisPerjalanan: "",
  kotaTujuan: "",
  dasarPenugasan: "",
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

export type PerdinField = keyof PerdinFormValues;

/** The form's tabs, in order, with the fields each one renders and so shows the errors of. */
export const PERDIN_TABS = [
  {
    value: "jenis-tujuan",
    label: "Jenis & tujuan",
    nemuId: NEMU_IDS.perdinForm.tabJenisTujuan,
    fields: ["jenisPerjalanan", "kotaTujuan", "dasarPenugasan", "maksud"],
  },
  {
    value: "jadwal",
    label: "Jadwal",
    nemuId: NEMU_IDS.perdinForm.tabJadwal,
    fields: ["tanggalBerangkat", "tanggalKembali", "modaTransport"],
  },
  {
    value: "biaya",
    label: "Biaya",
    nemuId: NEMU_IDS.perdinForm.tabBiaya,
    fields: ["biayaTransport", "penginapan", "nominalPenginapan", "uangHarian"],
  },
  {
    value: "dokumen",
    label: "Dokumen",
    nemuId: NEMU_IDS.perdinForm.tabDokumen,
    fields: ["dokumenUndangan"],
  },
] as const satisfies readonly {
  value: string;
  label: string;
  nemuId: string;
  fields: readonly PerdinField[];
}[];

export type PerdinTab = (typeof PERDIN_TABS)[number]["value"];

/** How Jenis perjalanan reads in the select; the wire keeps the full name. */
export const JENIS_PERJALANAN_OPTIONS = JENIS_PERJALANAN.map((value) => ({
  value,
  label: value.replace(/^Perjalanan d/, "D"),
}));

/** The signed-in user's surat tugas that Dasar penugasan offers; its nomor is sent as the trip's. */
export const SURAT_TUGAS = [
  { nomor: "ST-090/2026", perihal: "Rapat koordinasi Makassar" },
  { nomor: "ST-084/2026", perihal: "Bimbingan teknis layanan digital Jakarta" },
] as const;

export const DASAR_PENUGASAN_OPTIONS = SURAT_TUGAS.map(({ nomor, perihal }) => ({
  value: nomor,
  label: `${nomor} · ${perihal}`,
}));

/** Where every trip starts: the satker's city. */
export const KOTA_ASAL = "Yogyakarta";

/** Moda transportasi options, with the route once the destination is known. */
export function modaTransportOptions(kotaTujuan: string) {
  const kota = kotaTujuanOf(kotaTujuan);
  return MODA_TRANSPORT.map((value) => ({
    value,
    label: kota ? `${value} · ${KOTA_ASAL}–${kota} PP` : value,
  }));
}

/** The Biaya label for the round-trip fare, e.g. "Tiket pesawat PP · Yogyakarta–Makassar". */
export function biayaTransportLabel(modaTransport: string, kotaTujuan: string): string {
  const rute = `${KOTA_ASAL}–${kotaTujuanOf(kotaTujuan) ?? "tujuan"}`;
  return modaTransport === "Pesawat"
    ? `Tiket pesawat PP · ${rute}`
    : `Biaya transportasi PP · ${rute}`;
}

/** SBM uang harian luar kota per day for each destination's province. */
const UANG_HARIAN_LUAR_KOTA: Record<KotaTujuan, number> = {
  Makassar: 430_000,
  Jakarta: 530_000,
  Surabaya: 410_000,
  Bandung: 430_000,
  Medan: 370_000,
  Denpasar: 480_000,
};

/** The uang harian rate for a trip, when it is luar kota to a known destination. */
export function uangHarianPerHari(jenisPerjalanan: string, kotaTujuan: string): number | null {
  const kota = kotaTujuanOf(kotaTujuan);
  return jenisPerjalanan === "Perjalanan dinas luar kota" && kota
    ? UANG_HARIAN_LUAR_KOTA[kota]
    : null;
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** An amount as Indonesians write it, e.g. Rp430.000. */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount).replace(/\s/g, "");
}

/** The Demo App city a typed Kota tujuan names, ignoring case and spaces around it. */
export function kotaTujuanOf(text: string): KotaTujuan | undefined {
  const typed = text.trim().toLowerCase();
  return (Object.keys(KOTA_TUJUAN) as KotaTujuan[]).find((kota) => kota.toLowerCase() === typed);
}

/** File name of the sample undangan in `sample-documents/`; only the name is sent. */
export const DEMO_UNDANGAN_FILE_NAME = "undangan-rapat-koordinasi.pdf";

/**
 * What "Isi formulir demo" fills in on every tab: Rina's trip to Makassar on 3–5 November 2026.
 * Penginapan and nominal penginapan stay empty, because in Momen 2 Rina asks Nemu how to fill them.
 */
export const PERDIN_FORM_DEMO_VALUES = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  kotaTujuan: "Makassar",
  dasarPenugasan: "ST-090/2026",
  maksud: "Rapat koordinasi layanan digital",
  tanggalBerangkat: "2026-11-03",
  tanggalKembali: "2026-11-05",
  modaTransport: "Pesawat",
  biayaTransport: "3893000",
  uangHarian: "1290000",
} satisfies Partial<PerdinFormValues>;

const wajib = (message: string) => z.string().trim().min(1, { message, abort: true });
const rupiah = (message: string) =>
  wajib(message).regex(/^\d+$/, "Isi dengan angka tanpa titik atau koma");

export const perdinFormSchema = z
  .object({
    jenisPerjalanan: wajib("Pilih jenis perjalanan"),
    kotaTujuan: wajib("Isi kota tujuan").refine(
      (kota) => kotaTujuanOf(kota) !== undefined,
      `Kota tujuan yang tersedia: ${Object.keys(KOTA_TUJUAN).join(", ")}`,
    ),
    dasarPenugasan: wajib("Pilih surat tugas"),
    maksud: wajib("Isi maksud perjalanan"),
    tanggalBerangkat: wajib("Pilih tanggal berangkat"),
    tanggalKembali: wajib("Pilih tanggal kembali"),
    modaTransport: wajib("Pilih moda transportasi"),
    biayaTransport: rupiah("Isi biaya tiket"),
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

export type PerdinErrors = Partial<Record<PerdinField, string>>;

/** The first error of each field the form would refuse to send. */
export function perdinFormErrors(values: PerdinFormValues): PerdinErrors {
  const errors: PerdinErrors = {};
  for (const issue of perdinFormSchema.safeParse(values).error?.issues ?? []) {
    const field = issue.path[0] as PerdinField;
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * The errors the form shows: only on fields Rina has touched, so an untouched form stays clean,
 * and on every field once she has tried to send it.
 */
export function shownPerdinErrors(
  values: PerdinFormValues,
  fieldMeta: Partial<Record<PerdinField, { isTouched: boolean } | undefined>>,
  showAll: boolean,
): PerdinErrors {
  return Object.fromEntries(
    Object.entries(perdinFormErrors(values)).filter(
      ([field]) => showAll || fieldMeta[field as PerdinField]?.isTouched,
    ),
  );
}

/** The tabs holding a field that shows an error, so Rina can find it from any tab. */
export function tabsWithErrors(errors: PerdinErrors): PerdinTab[] {
  return PERDIN_TABS.filter((tab) => tab.fields.some((field) => errors[field])).map(
    (tab) => tab.value,
  );
}

export function toAjukanPerjalananDinasInput(values: PerdinFormValues): AjukanPerjalananDinasInput {
  return ajukanPerjalananDinasInputSchema.parse({
    jenisPerjalanan: values.jenisPerjalanan,
    // Dasar penugasan picks a surat tugas; the Process Instance keeps its nomor.
    nomorSuratTugas: values.dasarPenugasan,
    kotaTujuan: kotaTujuanOf(values.kotaTujuan),
    maksud: values.maksud,
    tanggalBerangkat: values.tanggalBerangkat,
    tanggalKembali: values.tanggalKembali,
    modaTransport: values.modaTransport,
    biayaTransport: Number(values.biayaTransport),
    penginapan: values.penginapan,
    nominalPenginapan: Number(values.nominalPenginapan),
    uangHarian: Number(values.uangHarian),
    dokumenUndangan: values.dokumenUndangan?.name ?? "",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lama perjalanan on Jadwal, e.g. 3–5 November is 3 hari and 2 malam. */
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

/** A calendar day as the form stores it, YYYY-MM-DD in local time. */
export function toIsoDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const hariTanggalFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A picked date as the date picker shows it, e.g. Selasa, 3 Nov 2026. */
export function formatHariTanggal(isoDate: string): string {
  return hariTanggalFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** The local calendar day of a YYYY-MM-DD date, for the date picker. */
export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
