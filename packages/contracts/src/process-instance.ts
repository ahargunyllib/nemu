import { z } from "zod";

/** Every State a Process Instance can be in (GLOSSARY.md), in the order the trip moves through. */
export const PROCESS_STATES = [
  "Draf",
  "Diajukan",
  "Disetujui",
  "Berangkat",
  "Kembali",
  "Pertanggungjawaban",
  "Verifikasi",
  "Selesai",
  "Revisi",
] as const;

export const processStateSchema = z.enum(PROCESS_STATES);

export type ProcessState = z.infer<typeof processStateSchema>;

export const JENIS_PERJALANAN = [
  "Perjalanan dinas luar kota",
  "Perjalanan dinas dalam kota",
] as const;

export const MODA_TRANSPORT = ["Pesawat", "Kereta api", "Bus", "Kendaraan dinas"] as const;

/** Destination cities the Demo App offers, with the province that selects their SBM row. */
export const KOTA_TUJUAN = {
  Makassar: "Sulawesi Selatan",
  Jakarta: "DKI Jakarta",
  Surabaya: "Jawa Timur",
  Bandung: "Jawa Barat",
  Medan: "Sumatera Utara",
  Denpasar: "Bali",
} as const;

export type KotaTujuan = keyof typeof KOTA_TUJUAN;

const KOTA_TUJUAN_NAMES = Object.keys(KOTA_TUJUAN) as [KotaTujuan, ...KotaTujuan[]];

/** `hotel` or `tidak_hotel` ("Tidak menginap di hotel"). */
export const PENGINAPAN = ["hotel", "tidak_hotel"] as const;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const rupiahSchema = z.number().int().min(0);

/** What Kirim on the Ajukan Perjalanan Dinas form sends to create a Process Instance. */
export const ajukanPerjalananDinasInputSchema = z
  .object({
    jenisPerjalanan: z.enum(JENIS_PERJALANAN),
    nomorSuratTugas: z.string().trim().min(1).max(100),
    kotaTujuan: z.enum(KOTA_TUJUAN_NAMES),
    maksud: z.string().trim().min(1).max(500),
    tanggalBerangkat: isoDateSchema,
    tanggalKembali: isoDateSchema,
    modaTransport: z.enum(MODA_TRANSPORT),
    biayaTransport: rupiahSchema,
    penginapan: z.enum(PENGINAPAN),
    nominalPenginapan: rupiahSchema,
    uangHarian: rupiahSchema,
    /** File name of the uploaded undangan; the file itself is not stored in the MVP. */
    dokumenUndangan: z.string().trim().min(1).max(200),
  })
  .refine((input) => input.tanggalKembali >= input.tanggalBerangkat, {
    path: ["tanggalKembali"],
    message: "Tanggal kembali tidak boleh sebelum tanggal berangkat",
  });

export type AjukanPerjalananDinasInput = z.infer<typeof ajukanPerjalananDinasInputSchema>;
