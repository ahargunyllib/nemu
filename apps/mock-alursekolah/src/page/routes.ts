import { Hono } from "hono";
import { z } from "zod";

import { SURAH, JUMLAH_AYAT, nomorSurah } from "../data/quran";
import {
  AKUN,
  JENIS_PENILAIAN,
  KATA_SANDI,
  MAPEL,
  SEKOLAH,
  SEMESTER,
  ditugaskan,
  pesanBelumDitugaskan,
  siswaKelas,
  type Akun,
} from "../data/sekolah";
import type { MockEnv } from "../env";
import { nilaiHafalan } from "../hafalan";
import {
  hapusSemua,
  semuaHafalan,
  semuaNilai,
  simpanNilai,
  tambahHafalan,
  type BarisHafalan,
  type HafalanBaru,
} from "../store";

// What the mock page calls on its own origin: school data, sign-in check, and saving grades and
// tahfidz records to the Worker so every browser sees the same data.

export const halaman = new Hono<{ Bindings: MockEnv }>();

class Ditolak extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403,
  ) {
    super(message);
  }
}

halaman.onError((error, c) => {
  if (error instanceof Ditolak) return c.json({ message: error.message }, error.status);
  if (error instanceof z.ZodError) return c.json({ message: "Isian tidak sah." }, 400);
  throw error;
});

function akunDari(username: string): Akun {
  const akun = AKUN[username];
  if (!akun) throw new Ditolak("Akun tidak dikenal. Masuk lagi.", 401);
  return akun;
}

const angka = (teks: string, label: string, min: number, max: number): number | null => {
  if (teks.trim() === "") return null;
  const n = Number(teks);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Ditolak(`${label} harus ${min} sampai ${max}.`, 400);
  }
  return n;
};

const teksNilai = (n: number | null) => (n === null ? "" : String(n));

const hariIni = () => new Date().toISOString().slice(0, 10);

halaman.get("/sekolah", (c) =>
  c.json({
    akun: AKUN,
    sekolah: SEKOLAH,
    mapel: MAPEL,
    surah: SURAH,
    siswa: Object.fromEntries(["4A", "4B", "5A"].map((k) => [k, siswaKelas(k).map((s) => s.nama)])),
  }),
);

halaman.post("/masuk", async (c) => {
  const { username, password } = z
    .object({ username: z.string(), password: z.string() })
    .parse(await c.req.json());
  if (!AKUN[username] || password !== KATA_SANDI) {
    throw new Ditolak("Nama pengguna atau kata sandi tidak cocok.", 401);
  }
  return c.json({ ok: true });
});

/** Saved sheets keyed `kelas|mapel|jenis`, then by student name, as the page reads them. */
halaman.get("/nilai", async (c) => {
  const semua: Record<string, Record<string, { nilai: string; catatan: string }>> = {};
  for (const n of await semuaNilai(c.env.DB)) {
    const kunci = `${n.kelas}|${n.mapel}|${n.jenis}`;
    semua[kunci] = {
      ...semua[kunci],
      [n.nama_siswa]: { nilai: teksNilai(n.skor), catatan: n.catatan },
    };
  }
  return c.json(semua);
});

const isianNilai = z.object({
  username: z.string(),
  kelas: z.string(),
  mapel: z.enum(MAPEL),
  jenis: z.enum(JENIS_PENILAIAN),
  baris: z.array(z.object({ nama: z.string(), nilai: z.string(), catatan: z.string() })),
});

halaman.put("/nilai", async (c) => {
  const isian = isianNilai.parse(await c.req.json());
  const akun = akunDari(isian.username);
  if (!akun.kelas.includes(isian.kelas) || !ditugaskan(akun, isian.kelas, isian.mapel)) {
    throw new Ditolak(pesanBelumDitugaskan(isian.kelas, isian.mapel), 403);
  }
  const murid = new Map(siswaKelas(isian.kelas).map((s) => [s.nama, s]));
  const tanggal = hariIni();
  const baris = isian.baris.map((b) => {
    const siswa = murid.get(b.nama);
    if (!siswa) throw new Ditolak(`${b.nama} bukan murid kelas ${isian.kelas}.`, 400);
    return {
      semester: SEMESTER,
      kelas: isian.kelas,
      mapel: isian.mapel,
      jenis: isian.jenis,
      nis: siswa.nis,
      nama_siswa: siswa.nama,
      skor: angka(b.nilai, `Nilai ${b.nama}`, 0, 100),
      catatan: b.catatan,
      guru: akun.email,
      tanggal,
    };
  });
  await simpanNilai(c.env.DB, baris);
  return c.json({ terisi: baris.filter((b) => b.skor !== null).length });
});

/** A tahfidz record as the page's Riwayat table shows it. */
function riwayat(h: BarisHafalan) {
  const nilai = nilaiHafalan(h);
  return {
    jenis: h.jenis,
    tanggal: h.tanggal,
    murid: h.nama_siswa,
    surah: h.surah_nomor ? (SURAH[h.surah_nomor - 1] ?? "") : "",
    jenis_ujian: h.jenis_ujian ?? "",
    ayat_dari: teksNilai(h.ayat_awal),
    ayat_sampai: teksNilai(h.ayat_akhir),
    fashohah: teksNilai(h.fashohah),
    tartil: teksNilai(h.tartil),
    tajwid: teksNilai(h.tajwid),
    adab: teksNilai(h.adab),
    catatan: h.catatan,
    nilai: nilai === null ? "belum dinilai" : nilai.toFixed(1),
  };
}

halaman.get("/tahfidz", async (c) => c.json((await semuaHafalan(c.env.DB)).map(riwayat)));

const teks = z.string().default("");
const isianTahfidz = z.object({
  username: z.string(),
  kelas: z.string(),
  baris: z
    .array(
      z.object({
        jenis: z.enum(["Setoran", "Ujian"]),
        tanggal: z.iso.date(),
        murid: z.string(),
        surah: teks,
        ayat_dari: teks,
        ayat_sampai: teks,
        jenis_ujian: teks,
        fashohah: teks,
        tartil: teks,
        tajwid: teks,
        adab: teks,
        catatan: teks,
      }),
    )
    .min(1),
});

halaman.post("/tahfidz", async (c) => {
  const isian = isianTahfidz.parse(await c.req.json());
  const akun = akunDari(isian.username);
  if (!akun.kelas.includes(isian.kelas) || !ditugaskan(akun, isian.kelas, "Tahfidz")) {
    throw new Ditolak(pesanBelumDitugaskan(isian.kelas, "Tahfidz"), 403);
  }
  const murid = new Map(siswaKelas(isian.kelas).map((s) => [s.nama, s]));
  const baris = isian.baris.map((b): HafalanBaru => {
    const siswa = murid.get(b.murid);
    if (!siswa) throw new Ditolak(`${b.murid} bukan murid kelas ${isian.kelas}.`, 400);
    const surah = b.jenis === "Setoran" ? nomorSurah(b.surah) : null;
    if (b.jenis === "Setoran" && surah === null) throw new Ditolak(`Pilih surah ${b.murid}.`, 400);
    if (b.jenis === "Ujian" && !["Ujian Juz 30", "Ujian Juz 29"].includes(b.jenis_ujian)) {
      throw new Ditolak(`Pilih jenis ujian ${b.murid}.`, 400);
    }
    const terakhir = surah ? (JUMLAH_AYAT[surah - 1] ?? 1) : 1;
    const ayatAwal = surah ? angka(b.ayat_dari, `Dari ayat ${b.murid}`, 1, terakhir) : null;
    const ayatAkhir = surah ? angka(b.ayat_sampai, `Sampai ayat ${b.murid}`, 1, terakhir) : null;
    if (ayatAwal !== null && ayatAkhir !== null && ayatAwal > ayatAkhir) {
      throw new Ditolak(`Dari ayat ${b.murid} lebih besar dari sampai ayat.`, 400);
    }
    return {
      jenis: b.jenis,
      tanggal: b.tanggal,
      kelas: isian.kelas,
      nis: siswa.nis,
      nama_siswa: siswa.nama,
      surah_nomor: surah,
      ayat_awal: ayatAwal,
      ayat_akhir: ayatAkhir,
      jenis_ujian: b.jenis === "Ujian" ? b.jenis_ujian : null,
      fashohah: angka(b.fashohah, `Fashohah ${b.murid}`, 0, 100),
      tartil: angka(b.tartil, `Tartil ${b.murid}`, 0, 100),
      tajwid: angka(b.tajwid, `Tajwid ${b.murid}`, 0, 100),
      adab: angka(b.adab, `Adab ${b.murid}`, 0, 100),
      catatan: b.catatan,
      guru: akun.email,
    };
  });
  await tambahHafalan(c.env.DB, baris);
  return c.json({ baris: baris.map((b, i) => riwayat({ ...b, id: i })) });
});

halaman.post("/reset", async (c) => {
  await hapusSemua(c.env.DB);
  return c.json({ ok: true });
});
