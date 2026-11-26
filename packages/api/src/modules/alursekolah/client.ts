import { z } from "zod";

/**
 * Read-only adapter for AlurSekolah API v1 (`https://business.alursekolah.id/api/v1/openapi.json`),
 * authenticated with the school's key (`Authorization: Bearer as_…`). The mock AlurSekolah follows
 * the same spec, so the WS-07 base URL alone decides whether this reads the mock or a real tenant.
 * Schemas keep only the fields the spec marks required as required; unknown fields are dropped.
 */

const metaSchema = z.object({
  total: z.number(),
  halaman: z.number().nullable(),
  ukuran: z.number().nullable(),
});

const nilaiSchema = z.object({
  id: z.number(),
  kode: z.string(),
  nis: z.string(),
  nama_siswa: z.string().optional(),
  kelas: z.string().optional(),
  semester: z.string(),
  mapel: z.string(),
  jenis: z.string(),
  topik: z.string().optional(),
  skor: z.number(),
  tanggal: z.string().optional(),
  catatan: z.string().optional(),
  guru: z.string().optional(),
});
export type AlurSekolahNilai = z.infer<typeof nilaiSchema>;

const nilaiListSchema = z.object({
  data: z.array(nilaiSchema),
  meta: metaSchema,
  kelompok: z.record(z.string(), z.number()).optional(),
});

const rekapListSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  meta: metaSchema,
  kkm: z.number(),
});

const siswaSchema = z.object({
  id: z.number(),
  nis: z.string(),
  nama: z.string(),
  kelas: z.string(),
  tingkat: z.number().optional(),
  wali_kelas: z.string().optional(),
  aktif: z.boolean().optional(),
  jenjang: z.string().optional(),
  angkatan: z.string().optional(),
  status: z.string().optional(),
});
export type AlurSekolahSiswa = z.infer<typeof siswaSchema>;

const siswaListSchema = z.object({ data: z.array(siswaSchema), meta: z.unknown() });

const kelasListSchema = z.object({
  data: z.array(
    z.object({
      kelas: z.string(),
      tingkat: z.number().nullable(),
      siswa_aktif: z.number(),
      tambahan: z.boolean(),
    }),
  ),
});

const guruSayaSchema = z.object({
  data: z.object({
    email: z.string(),
    nama: z.string(),
    aktif: z.boolean(),
    kelas: z.array(z.string()),
    semua_kelas: z.boolean(),
    wali_kelas: z.string(),
  }),
});

const setoranSchema = z.object({
  id: z.number(),
  kode: z.string(),
  nis: z.string(),
  nama_siswa: z.string().optional(),
  kelas: z.string().optional(),
  tanggal: z.string(),
  juz: z.number(),
  ayat: z.number(),
  surah_nomor: z.number().nullable(),
  surah_nama: z.string().nullable(),
  ayat_awal: z.number().nullable(),
  ayat_akhir: z.number().nullable(),
  penilaian: z.string().nullable(),
  penilaian_label: z.string().nullable(),
  nilai: z.number().nullable(),
  huruf: z.string().nullable(),
  keputusan: z.string().nullable(),
  keterangan: z.string().nullable(),
  label: z.string(),
  catatan: z.string().optional(),
  guru: z.string().optional(),
});
const setoranListSchema = z.object({ data: z.array(setoranSchema), meta: metaSchema });

/** List conventions shared by every v1 list: no `halaman` returns every row. */
type ListQuery = {
  halaman?: number;
  ukuran?: number;
  cari?: string;
  urut?: string;
  arah?: "asc" | "desc";
};

export type NilaiQuery = ListQuery & {
  kelas?: string;
  nis?: string;
  mapel?: string;
  semester?: string;
  jenis?: string;
  hitung?: "mapel" | "jenis" | "kelas";
};
export type RekapQuery = ListQuery & {
  per?: "siswa" | "mapel" | "kelas";
  kelas?: string;
  nis?: string;
  mapel?: string;
  semester?: string;
};
export type SiswaQuery = ListQuery & {
  kelas?: string;
  aktif?: "true" | "false";
  status?: "aktif" | "lulus" | "pindah" | "keluar" | "nonaktif";
  tingkat?: number;
  nis?: string;
};
export type SetoranQuery = ListQuery & {
  nis?: string;
  kelas?: string;
  tanggal?: string;
  dari?: string;
  sampai?: string;
  juz?: number;
  penilaian?: "lancar" | "cukup" | "ulang";
};

export type AlurSekolahClient = {
  nilai(query?: NilaiQuery): Promise<z.infer<typeof nilaiListSchema>>;
  nilaiRekap(query?: RekapQuery): Promise<z.infer<typeof rekapListSchema>>;
  siswa(query?: SiswaQuery): Promise<z.infer<typeof siswaListSchema>>;
  kelas(): Promise<z.infer<typeof kelasListSchema>>;
  guruSaya(): Promise<z.infer<typeof guruSayaSchema>>;
  hafalanSetoran(query?: SetoranQuery): Promise<z.infer<typeof setoranListSchema>>;
};

export type AlurSekolahErrorKind = "unauthorized" | "unreachable" | "rejected" | "bad_response";

/** Never carries the key: only the path, the HTTP status, and AlurSekolah's own message. */
export class AlurSekolahError extends Error {
  constructor(
    readonly kind: AlurSekolahErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AlurSekolahError";
  }
}

/** Accepts the school's address with or without `/api/v1` and trailing slashes. */
export function normalizeAlurSekolahBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/u, "")
    .replace(/\/api\/v1$/u, "");
}

export function createAlurSekolahClient(options: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}): AlurSekolahClient {
  const base = normalizeAlurSekolahBaseUrl(options.baseUrl);
  const doFetch = options.fetch ?? fetch;

  async function get<T>(path: string, schema: z.ZodType<T>, query: object = {}): Promise<T> {
    const url = new URL(`${base}/api/v1${path}`);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(name, String(value));
      }
    }
    let response: Response;
    try {
      response = await doFetch(url, {
        headers: { Authorization: `Bearer ${options.apiKey}`, Accept: "application/json" },
      });
    } catch (error) {
      throw new AlurSekolahError(
        "unreachable",
        `AlurSekolah tidak bisa dihubungi (${url.host}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body ? String(body.message) : "";
      const kind = response.status === 401 || response.status === 403 ? "unauthorized" : "rejected";
      throw new AlurSekolahError(
        kind,
        `AlurSekolah menolak GET ${path} (HTTP ${response.status})${message ? `: ${message}` : ""}`,
        response.status,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AlurSekolahError(
        "bad_response",
        `Jawaban AlurSekolah untuk GET ${path} tidak sesuai API v1: ${parsed.error.issues[0]?.message ?? ""}`,
      );
    }
    return parsed.data;
  }

  return {
    nilai: (query) => get("/nilai", nilaiListSchema, query),
    nilaiRekap: (query) => get("/nilai/rekap", rekapListSchema, query),
    siswa: (query) => get("/siswa", siswaListSchema, query),
    kelas: () => get("/kelas", kelasListSchema),
    guruSaya: () => get("/akademik/guru/saya", guruSayaSchema),
    hafalanSetoran: (query) => get("/hafalan/setoran", setoranListSchema, query),
  };
}
