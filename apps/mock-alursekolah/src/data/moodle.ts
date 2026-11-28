import type { BarisNilai } from "../store";
import { SEMESTER } from "./sekolah";

// Nilai kuis yang ditulis modul Moodle ke AlurSekolah setelah sinkron (F4 · Kuis Moodle). Nemu belum
// punya jalur sinkron Moodle → AlurSekolah, jadi tiruan membawa hasil sinkron kuis F4 sebagai baris
// tetap: selalu ada, juga sesudah "Reset semua data uji", seperti nilai yang sudah masuk.

export const MATERI_KUIS_F4 = "Latihan IPAS Kelas 4A · Moodle";

const kuis = (id: number, nis: string, nama_siswa: string, skor: number): BarisNilai => ({
  id,
  semester: SEMESTER,
  kelas: "4A",
  mapel: "IPAS",
  jenis: "Kuis",
  nis,
  nama_siswa,
  skor,
  catatan: "",
  guru: "siti.aminah@sditnusantara.sch.id",
  tanggal: "2026-12-10",
  materi: MATERI_KUIS_F4,
});

/** Ids far above the page's own rows, so the two never collide. */
export const NILAI_MOODLE: readonly BarisNilai[] = [
  kuis(900001, "4101", "Aisyah Putri Wijaya", 90),
  kuis(900002, "4104", "Bagas Pratama", 70),
  kuis(900003, "4105", "Citra Lestari", 100),
];
