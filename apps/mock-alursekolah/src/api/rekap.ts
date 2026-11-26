import { KKM } from "../data/sekolah";
import type { BarisNilai } from "../store";

export type SatuanRekap = "siswa" | "mapel" | "kelas";

type NilaiTerisi = BarisNilai & { skor: number };

const bulat1 = (n: number) => Math.round(n * 10) / 10;
const rata = (xs: readonly number[]) =>
  xs.length ? bulat1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

function kelompokkan<T, K>(xs: readonly T[], kunci: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = kunci(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

/** A student's final grade in one subject: the plain mean of every assessment (the default formula). */
interface NilaiAkhir {
  nis: string;
  nama_siswa: string;
  kelas: string;
  semester: string;
  mapel: string;
  nilai_akhir: number;
  jumlah: number;
  tuntas: boolean;
}

function nilaiAkhir(rows: readonly NilaiTerisi[]): NilaiAkhir[] {
  return [...kelompokkan(rows, (r) => `${r.nis}|${r.mapel}`).values()].map((grup) => {
    const [r] = grup as [NilaiTerisi, ...NilaiTerisi[]];
    const akhir = rata(grup.map((g) => g.skor));
    return {
      nis: r.nis,
      nama_siswa: r.nama_siswa,
      kelas: r.kelas,
      semester: r.semester,
      mapel: r.mapel,
      nilai_akhir: akhir,
      jumlah: grup.length,
      tuntas: akhir >= KKM,
    };
  });
}

function perSiswa(akhir: readonly NilaiAkhir[]) {
  return [...kelompokkan(akhir, (a) => a.nis).values()].map((mapel) => {
    const [a] = mapel as [NilaiAkhir, ...NilaiAkhir[]];
    return {
      nis: a.nis,
      nama_siswa: a.nama_siswa,
      kelas: a.kelas,
      semester: a.semester,
      rata: rata(mapel.map((m) => m.nilai_akhir)),
      jumlah: mapel.length,
      tuntas: mapel.every((m) => m.tuntas),
      mapel: mapel.map((m) => ({
        mapel: m.mapel,
        nilai_akhir: m.nilai_akhir,
        jumlah: m.jumlah,
        tuntas: m.tuntas,
      })),
    };
  });
}

function perKelompok(akhir: readonly NilaiAkhir[], satuan: "mapel" | "kelas") {
  return [...kelompokkan(akhir, (a) => a[satuan]).entries()].map(([nama, grup]) => {
    const siswa = perSiswa(grup);
    return {
      [satuan]: nama,
      rata: rata(grup.map((g) => g.nilai_akhir)),
      jumlah: grup.reduce((n, g) => n + g.jumlah, 0),
      siswa: siswa.length,
      tuntas_persen: bulat1((100 * siswa.filter((s) => s.tuntas).length) / siswa.length),
    };
  });
}

/**
 * `GET /api/v1/nilai/rekap` rows. Tuntas means the final grade reaches the test data's KKM (75).
 * per=siswa lists each subject; per=mapel and per=kelas give the share of students who are tuntas.
 */
export function rekapNilai(
  rows: readonly BarisNilai[],
  per: SatuanRekap,
): Record<string, unknown>[] {
  const akhir = nilaiAkhir(rows.filter((r): r is NilaiTerisi => r.skor !== null));
  return per === "siswa" ? perSiswa(akhir) : perKelompok(akhir, per);
}
