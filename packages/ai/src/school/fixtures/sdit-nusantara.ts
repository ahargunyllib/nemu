import type { KnowledgeChunk } from "../../knowledge.js";
import type { RosterStudent } from "../names.js";
import type { ClassRoster, TeacherProfile } from "../profile.js";

/**
 * Synthetic school for tests and the demo directory (fictional SDIT Nusantara, PRD §10).
 * Names that appear in the PRD wireframes are kept; the rest are invented. Replace with the
 * official data-uji-mvp-v2 roster (00_BACA-DULU.md) when it is available.
 */

const CLASS_4B_NAMES = [
  "Ahmad Fadil",
  "Alysa Zahra",
  "Alya Nur Fitri",
  "Bagas Saputra",
  "Budi Santoso",
  "Citra Ayu Lestari",
  "Dimas Prasetyo",
  "Dinda Maharani",
  "Fajar Nugroho",
  "Farah Annisa",
  "Gita Ramadhani",
  "Hana Salsabila",
  "Ilham Maulana",
  "Intan Permata",
  "Kevin Ardiansyah",
  "Laila Khairunnisa",
  "Muhammad Rizky Pratama",
  "Nabila Putri",
  "Naufal Hakim",
  "Putri Ayu Wulandari",
  "Raka Aditya",
  "Rania Azzahra",
  "Reza Firmansyah",
  "Rizal Akbar",
  "Salsa Amelia",
  "Satria Wibowo",
  "Siti Nurhaliza",
  "Syifa Aulia",
  "Taufik Hidayat",
  "Vania Maharani",
  "Yusuf Ibrahim",
  "Zahra Kamila",
] as const;

export const CLASS_4B: RosterStudent[] = CLASS_4B_NAMES.map((name, index) => ({
  studentId: `4b-${String(index + 1).padStart(2, "0")}`,
  name,
  number: index + 1,
}));

export const DEMO_ROSTERS: ClassRoster[] = [{ className: "4B", students: CLASS_4B }];

export const BU_SITI: TeacherProfile = {
  teacherId: "siti",
  name: "Siti Rahmawati",
  honorific: "Bu",
  nip: "197001012000032001",
  phone: "6281200000099",
  schoolName: "SDIT Nusantara",
  classes: ["4B"],
  subjects: ["Matematika", "IPA", "Bahasa Indonesia"],
  contacts: {
    kepsek: { name: "Pak Ahmad", role: "kepsek", phone: "6281200000001" },
    operator: { name: "Pak Rizal", role: "operator", phone: "6281200000002" },
    keuangan: { name: "Bu Ratna", role: "keuangan", phone: "6281200000003" },
  },
};

const SOP = {
  docId: "sop-penilaian-sdit-nusantara",
  title: "SOP Penilaian SDIT Nusantara",
  version: "2026",
};

/** Synthetic SOP Penilaian chunks (stand-in for F3-2_SOP-Penilaian-SDIT-Nusantara.pdf). */
export const SOP_CHUNKS: KnowledgeChunk[] = [
  {
    id: "sop-p2-3-2",
    ...SOP,
    page: 2,
    article: "3.2",
    active: true,
    text: "3.2 Kriteria Ketuntasan Minimal (KKM) untuk seluruh mata pelajaran adalah 75. Peserta didik dengan nilai di bawah 75 wajib mengikuti remedial.",
  },
  {
    id: "sop-p2-3-3",
    ...SOP,
    page: 2,
    article: "3.3",
    active: true,
    text: "3.3 Remedial dilaksanakan paling banyak 2 kali. Nilai hasil remedial paling tinggi 75.",
  },
  {
    id: "sop-p3-4-1",
    ...SOP,
    page: 3,
    article: "4.1",
    active: true,
    text: "4.1 Nilai UTS diinput ke AlurSekolah paling lambat 7 hari kerja setelah pelaksanaan UTS.",
  },
  {
    id: "sop-p3-4-3",
    ...SOP,
    page: 3,
    article: "4.3",
    active: true,
    text: "4.3 Peserta didik yang tidak hadir karena sakit, izin, atau alpa nilainya dikosongkan, bukan diberi nilai 0, sampai mengikuti ujian susulan.",
  },
];
