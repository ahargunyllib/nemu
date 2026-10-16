import type { NemuUserProfile } from "./openai.js";
import type { KnowledgeChunk } from "./knowledge.js";
import type { SbmRow } from "./tools.js";

export const DEMO_USER_PROFILE: NemuUserProfile = {
  userId: "rina",
  name: "Rina",
  grade: "III/a",
  unit: "Satuan kerja kementerian di Yogyakarta",
  province: "DI Yogyakarta",
};

export const DEMO_KNOWLEDGE_CHUNKS: readonly KnowledgeChunk[] = [
  {
    id: "sop-pd-01-mulai",
    docId: "sop-pd-01",
    title: "SOP-PD-01 Perjalanan Dinas (SINTETIS)",
    version: "1.0",
    article: "Bagian 2",
    page: 2,
    active: true,
    text: "Pegawai yang menerima surat tugas perjalanan dinas luar kota memulai pengajuan melalui menu Ajukan Perjalanan Dinas. Siapkan surat tugas, jadwal, rencana biaya, dan dokumen pendukung.",
  },
  {
    id: "sop-pd-01-dokumen",
    docId: "sop-pd-01",
    title: "SOP-PD-01 Perjalanan Dinas (SINTETIS)",
    version: "1.0",
    article: "Bagian 6",
    page: 6,
    active: true,
    text: "Dokumen pertanggungjawaban perjalanan dinas dilengkapi dengan laporan perjalanan, surat tugas, bukti transportasi termasuk boarding pass pergi dan pulang, serta bukti pengeluaran yang diwajibkan.",
  },
  {
    id: "pmk-119-2023-pasal-8-5",
    docId: "pmk-119-2023",
    title: "PMK 119/2023",
    version: "2023",
    article: "8 ayat (5)",
    page: 6,
    active: true,
    text: "Pelaksana perjalanan dinas yang tidak menggunakan biaya penginapan diberikan biaya penginapan secara lumpsum sebesar 30 persen dari tarif hotel di kota tempat tujuan. Ketentuan ini berlaku antara lain ketika menginap di rumah saudara.",
  },
  {
    id: "pmk-113-2012-pasal-34",
    docId: "pmk-113-2012",
    title: "PMK 113/PMK.05/2012",
    version: "2012",
    article: "34",
    active: true,
    text: "Pertanggungjawaban biaya perjalanan dinas disampaikan paling lambat lima hari kerja setelah perjalanan dinas dilaksanakan atau pegawai kembali.",
  },
  {
    id: "panduan-app-perdin",
    docId: "panduan-app-demo",
    title: "Panduan App Tiruan",
    version: "1.0",
    article: "Menu dan task",
    page: 3,
    active: true,
    text: "Menu Ajukan Perjalanan Dinas membuka formulir baru. Setelah pegawai kembali, task Pertanggungjawaban muncul di My Task dan harus dilengkapi sebelum dikirim ke verifikator.",
  },
  {
    id: "pmk-54-2026-inactive",
    docId: "pmk-54-2026",
    title: "PMK 54/2026 tentang SBM TA 2027",
    version: "2027",
    active: false,
    text: "Dokumen ini tidak aktif dan tidak boleh digunakan untuk perjalanan pada tahun anggaran 2026.",
  },
];

export const DEMO_SBM_ROWS: readonly SbmRow[] = [
  {
    province: "Sulawesi Selatan",
    component: "hotel",
    grade: "III",
    value: 745_000,
    source: "SBM TA 2026 halaman 19 - Sulawesi Selatan - Hotel Golongan III",
  },
  {
    province: "Sulawesi Selatan",
    component: "uang_harian",
    grade: "III",
    value: 430_000,
    source: "SBM TA 2026 - Sulawesi Selatan - Uang Harian",
  },
  {
    province: "Sulawesi Selatan",
    component: "tiket_pesawat",
    grade: "III",
    value: 3_893_000,
    source: "SBM TA 2026 - Yogyakarta-Makassar pulang-pergi",
  },
];

export const DEMO_HOLIDAYS_2026: readonly string[] = [];

export const DEMO_REQUIRED_DOCUMENTS: readonly string[] = [
  "surat_tugas",
  "boarding_pass_pergi",
  "boarding_pass_pulang",
  "laporan_perjalanan",
];
