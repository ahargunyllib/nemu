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

/** Only the modes that fit the demo's Yogyakarta–Makassar trip. */
export const MODA_TRANSPORT = ["Pesawat", "Kendaraan dinas"] as const;

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

/**
 * Documents the Pertanggungjawaban task asks for, named as the AI reads them in
 * `process_context.uploaded_documents`.
 */
export const DOKUMEN_PERTANGGUNGJAWABAN = [
  "surat_tugas",
  "boarding_pass_pergi",
  "boarding_pass_pulang",
  "laporan_perjalanan",
] as const;

export const dokumenPertanggungjawabanSchema = z.enum(DOKUMEN_PERTANGGUNGJAWABAN);

export type DokumenPertanggungjawaban = z.infer<typeof dokumenPertanggungjawabanSchema>;

export const processInstanceIdInputSchema = z.object({
  instanceId: z.string().trim().min(1).max(40),
});

/** Uploading one Pertanggungjawaban document; only the file name is stored in the MVP. */
export const unggahDokumenInputSchema = processInstanceIdInputSchema.extend({
  jenis: dokumenPertanggungjawabanSchema,
  namaFile: z.string().trim().min(1).max(200),
});

export type UnggahDokumenInput = z.infer<typeof unggahDokumenInputSchema>;

/**
 * What the Nemu Extension reads from `get_process_instance`: the State and the active Task,
 * whose `id` is the task ID. Other fields of the reply are dropped.
 */
export const processInstanceStatusSchema = z.object({
  id: z.string().min(1),
  state: processStateSchema,
  activeTask: z.object({ id: z.string().min(1), label: z.string() }).nullable(),
});

export type ProcessInstanceStatus = z.infer<typeof processInstanceStatusSchema>;
