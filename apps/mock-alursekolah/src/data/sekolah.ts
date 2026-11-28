import { SISWA, type Siswa } from "./siswa";

// Data sintetis SDIT Nusantara dari 01_profil-sekolah/profil-sekolah.json dan tiruan Richard
// (05_tiruan-alursekolah/index.html). Akun, kata sandi, dan penugasan sama persis dengan tiruan itu.

/** Penugasan mapel per kelas yang diatur admin; operator memegang semua. */
export type Penugasan = Readonly<Record<string, readonly string[]>> | "semua";

export interface Akun {
  readonly nama: string;
  /** How the school addresses the account, for the Beranda greeting ("Bu Siti"). */
  readonly panggilan: string;
  readonly email: string;
  readonly peran: "guru" | "operator";
  readonly wali?: string;
  readonly kelas: readonly string[];
  readonly tugas: Penugasan;
  readonly wa: string;
  readonly nip?: string;
}

export const KATA_SANDI = "nemu-uji-2026";

export const AKUN: Readonly<Record<string, Akun>> = {
  // IPAS 4A SENGAJA belum ditugaskan ke Bu Siti (kasus uji F2-2).
  "siti.aminah": {
    nama: "Siti Aminah, S.Pd.",
    panggilan: "Bu Siti",
    email: "siti.aminah@sditnusantara.sch.id",
    peran: "guru",
    wali: "4A",
    kelas: ["4A", "4B"],
    tugas: { "4A": ["Bahasa Inggris", "Tahfidz"], "4B": ["Matematika", "Bahasa Indonesia"] },
    wa: "+62 812-0000-1001",
    nip: "197003152000032001",
  },
  "dewi.lestari": {
    nama: "Dewi Lestari, S.Pd.",
    panggilan: "Bu Dewi",
    email: "dewi.lestari@sditnusantara.sch.id",
    peran: "guru",
    wali: "5A",
    kelas: ["5A"],
    tugas: { "5A": ["Bahasa Indonesia"] },
    wa: "+62 812-0000-1004",
  },
  "rizal.operator": {
    nama: "Rizal Pratama",
    panggilan: "Pak Rizal",
    email: "rizal.operator@sditnusantara.sch.id",
    peran: "operator",
    kelas: ["4A", "4B", "5A"],
    tugas: "semua",
    wa: "+62 812-0000-1003",
  },
};

/** Akun yang membuat kunci API sekolah (admin sekolah = operator). */
export const PEMBUAT_KUNCI_API = "rizal.operator";

export const SEKOLAH = {
  nama: "SDIT Nusantara",
  kepsek: "Ahmad Fauzi, M.Pd. (Pak Ahmad)",
  operator: "Rizal Pratama (Pak Rizal)",
};

export const SEMESTER = "2026/2027 Ganjil";
export const KKM = 75;
export const MAPEL = ["Matematika", "IPAS", "Bahasa Indonesia", "Bahasa Inggris"] as const;
export const JENIS_PENILAIAN = ["Harian", "UTS", "UAS"] as const;
export const KELAS = ["4A", "4B", "5A"] as const;

export function ditugaskan(akun: Akun, kelas: string, mapel: string): boolean {
  return akun.tugas === "semua" || (akun.tugas[kelas] ?? []).includes(mapel);
}

/** Pesan AlurSekolah saat guru membuka mapel yang belum ditugaskan (F2-2). */
export function pesanBelumDitugaskan(kelas: string, mapel: string): string {
  return `Anda belum ditugaskan mengampu ${mapel} di kelas ${kelas}. Hubungi admin sekolah.`;
}

export function siswaKelas(kelas: string): readonly Siswa[] {
  return SISWA.filter((s) => s.kelas === kelas);
}

export function tingkat(kelas: string): number | null {
  const angka = Number.parseInt(kelas, 10);
  return Number.isNaN(angka) ? null : angka;
}

export function waliKelas(kelas: string): string | undefined {
  return Object.values(AKUN).find((a) => a.wali === kelas)?.nama;
}
