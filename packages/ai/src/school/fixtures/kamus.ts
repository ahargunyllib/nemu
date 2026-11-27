import type { PageSnapshot } from "@nemu/contracts/school";

import type { KamusRow } from "../kamus.js";

/**
 * The official test pack's Kamus Kendala SDIT Nusantara (`kamus-kendala-sdit-nusantara.json`,
 * synthetic), as seeded in W-SEKOLAH by `20261127180000_official_kamus`. No. 6 is empty on
 * purpose: the old PK-409 message tests "belum ada di panduan sekolah".
 */
export const KAMUS_ROWS: KamusRow[] = [
  {
    id: "k01",
    code: "K-01",
    app: "Ruang GTK",
    message:
      "Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ada RHK atasan yang bisa dikaitkan.",
    meaning:
      "Rencana kerja (RHK) kepala sekolah belum lengkap atau belum disepakati, jadi rencana kerja Ibu/Bapak belum bisa dikaitkan ke atasan.",
    teacherFault: false,
    fixer: "kepsek",
    fix: "Kepala sekolah menyelesaikan dan menyepakati perencanaan SKP-nya. Setelah itu guru menekan kirim ulang. Kalau data atasan di sistem salah, kepala sekolah menghubungi admin kepegawaian.",
  },
  {
    id: "k02",
    code: "K-02",
    app: "Ruang GTK",
    message:
      "Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ditandai sebagai User Ruang GTK.",
    meaning: "Akun E-Kinerja Ibu/Bapak belum ditandai sebagai pengguna Ruang GTK.",
    teacherFault: false,
    fixer: "guru",
    fix: 'Buka E-Kinerja, tekan tombol "Sinkro Ruang GTK", lalu ikuti petunjuknya. Setelah itu coba kirim ulang dari Ruang GTK.',
  },
  {
    id: "k03",
    code: "K-03",
    app: "Info GTK",
    message: "Pengguna tidak ditemukan.",
    meaning:
      "Akun Ibu/Bapak belum dikenali Info GTK. Biasanya email atau data PTK di Dapodik belum sesuai atau belum tersinkron.",
    teacherFault: false,
    fixer: "operator",
    fix: "Operator memeriksa email dan data PTK guru di Dapodik, memperbaikinya, lalu melakukan sinkronisasi. Guru mencoba masuk lagi setelah sinkron.",
  },
  {
    id: "k04",
    code: "K-04",
    app: "Info GTK",
    message: "Beban Mengajar: Tidak Valid (JJM kurang dari 24 jam).",
    meaning:
      "Jam mengajar yang tercatat kurang dari 24 jam per minggu, jadi syarat tunjangan belum terpenuhi.",
    teacherFault: false,
    fixer: "operator",
    fix: "Operator memeriksa rombel dan pembelajaran guru di Dapodik, memperbaiki jam yang belum tercatat, lalu sinkronisasi. Perubahan di Info GTK bisa butuh 1-7 hari.",
  },
  {
    id: "k05",
    code: "K-05",
    app: "e-Rapor SD",
    message: "Deskripsi capaian kosong. Tujuan pembelajaran belum dipilih.",
    meaning:
      "Deskripsi rapor dibuat dari tujuan pembelajaran. Karena belum dipilih, deskripsinya kosong.",
    teacherFault: false,
    fixer: "guru",
    fix: "Buka menu tujuan pembelajaran untuk mapel tersebut, centang tujuan pembelajaran yang dinilai, simpan, lalu cetak ulang.",
  },
  {
    id: "k07",
    code: "K-07",
    app: "AlurSekolah",
    message: "Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
    meaning:
      "Bukan kesalahan Ibu/Bapak. Penugasan guru per mapel dan kelas diatur admin sekolah, dan mapel ini belum dipasangkan ke akun Ibu/Bapak untuk kelas tersebut.",
    teacherFault: false,
    fixer: "operator",
    fix: "Operator menambahkan penugasan guru untuk mapel dan kelas itu di pengaturan AlurSekolah. Setelah itu guru memuat ulang halaman Isi nilai kelas.",
  },
];

/** F2-2_alursekolah_belum-ditugaskan.png as the extension reads it (#216). */
export const F2_2_PAGE: PageSnapshot = {
  title: "AlurSekolah (tiruan)",
  url: "https://sdit-nusantara.alursekolah.tiruan.local/penilaian/isi-nilai-kelas",
  alerts: [
    "Tidak dapat menampilkan siswa. Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
  ],
  headings: ["Isi nilai kelas 4A"],
  fields: [
    { label: "Kelas", value: "4A" },
    { label: "Mata Pelajaran", value: "IPAS" },
    { label: "Jenis Penilaian", value: "Harian" },
  ],
  screenshotBase64: null,
};

/** F2-3_ruang-gtk_bukan-user.png as the extension reads it. */
export const F2_3_PAGE: PageSnapshot = {
  title: "Ruang GTK (tiruan)",
  url: "https://ruang-gtk.tiruan.local/kinerja",
  alerts: [
    'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ditandai sebagai User Ruang GTK. Mohon coba lagi atau Anda dapat juga menekan tombol "Sinkro Ruang GTK" di E-Kinerja dan ikuti petunjuknya.',
  ],
  headings: ["Pengelolaan Kinerja 2026"],
  fields: [],
  screenshotBase64: null,
};

/**
 * Screens the kamus doesn't cover: the old F2-6 (cadangan-v2.2, kode PK-409), a Ruang GTK reason
 * that shares most words with no. 1 and no. 2 but is neither, and a page with no error at all.
 */
export const NOT_IN_GUIDE_PAGES: Record<string, PageSnapshot> = {
  "F2-6 PK-409": {
    title: "E-Kinerja (tiruan)",
    url: "https://e-kinerja.tiruan.local/penilaian",
    alerts: ["Periode penilaian sudah dikunci oleh pengelola kepegawaian (kode PK-409)."],
    headings: ["Penilaian Kinerja 2026"],
    fields: [],
    screenshotBase64: null,
  },
  "Ruang GTK, another reason": {
    ...F2_3_PAGE,
    alerts: [
      "Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Periode penilaian belum dibuka.",
    ],
  },
  "Data Saya, no error": {
    title: "Ruang GTK (tiruan)",
    url: "https://ruang-gtk.tiruan.local/data-saya",
    alerts: [],
    headings: ["Data Saya"],
    fields: [],
    screenshotBase64: null,
  },
};
