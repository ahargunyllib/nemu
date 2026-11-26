import { JUMLAH_AYAT, SURAH, juzAyat } from "./data/quran";
import type { BarisHafalan } from "./store";

type Skor = Pick<BarisHafalan, "fashohah" | "tartil" | "tajwid" | "adab">;

const ASPEK = ["fashohah", "tartil", "tajwid", "adab"] as const;

/**
 * Weighted tahfidz score (Fashohah 30%, Tartil 30%, Tajwid 30%, Adab 10%), rounded the way the
 * page shows it. null while any aspect is still empty ("belum dinilai").
 */
export function nilaiHafalan(skor: Skor): number | null {
  const { fashohah, tartil, tajwid, adab } = skor;
  if (fashohah === null || tartil === null || tajwid === null || adab === null) return null;
  return Number((0.3 * fashohah + 0.3 * tartil + 0.3 * tajwid + 0.1 * adab).toFixed(1));
}

/** The ayat range a setoran covers: an empty "from" starts at 1, an empty "to" runs to the end. */
export function rentangAyat(baris: Pick<BarisHafalan, "surah_nomor" | "ayat_awal" | "ayat_akhir">) {
  const surah = baris.surah_nomor ?? 1;
  const terakhir = JUMLAH_AYAT[surah - 1] ?? 1;
  const awal = baris.ayat_awal ?? 1;
  const akhir = baris.ayat_akhir ?? terakhir;
  return { surah, awal, akhir, utuh: awal === 1 && akhir === terakhir };
}

/** A saved setoran in the shape of AlurSekolah's `GET /api/v1/hafalan/setoran`. */
export function setoranApi(baris: BarisHafalan) {
  const { surah, awal, akhir, utuh } = rentangAyat(baris);
  const nama = SURAH[surah - 1] ?? "";
  const terisi = ASPEK.filter((a) => baris[a] !== null);
  return {
    id: baris.id,
    kode: `ST-${String(baris.id).padStart(6, "0")}`,
    nis: baris.nis,
    nama_siswa: baris.nama_siswa,
    kelas: baris.kelas,
    tanggal: baris.tanggal,
    juz: juzAyat(surah, awal),
    ayat: akhir - awal + 1,
    surah: nama,
    catatan: baris.catatan,
    guru: baris.guru,
    surah_nomor: surah,
    surah_nama: nama,
    ayat_awal: awal,
    ayat_akhir: akhir,
    penilaian: null,
    penilaian_label: null,
    skor: terisi.length ? Object.fromEntries(terisi.map((a) => [a, baris[a]])) : null,
    nilai: nilaiHafalan(baris),
    huruf: null,
    nada: null,
    keputusan: null,
    keterangan: null,
    label: `${nama}, ayat ${awal}-${akhir}${utuh ? " (utuh)" : ""}`,
  };
}
