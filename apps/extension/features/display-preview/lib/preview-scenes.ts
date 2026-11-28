import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

/**
 * Dev-only preview of the five display types and the Nemu cursor (#201), so they can be reviewed
 * on the mock AlurSekolah without the AI. Open an allowed page of a dev build with
 * `?pratinjau-nemu`, e.g. http://localhost:3003/?pratinjau-nemu#/nilai.
 */
export const PREVIEW_ENABLED =
  import.meta.env.DEV && new URLSearchParams(location.search).has("pratinjau-nemu");

export type PreviewScene =
  | "kerja"
  | "baca-foto"
  | "tunjuk"
  | "jawab"
  | "jawab-proses"
  | "belum-jelas"
  | "pilih"
  | "hati-hati"
  | "info"
  | "kursor";

export const PREVIEW_SCENES: readonly { scene: PreviewScene; label: string }[] = [
  { scene: "kerja", label: "Kerja" },
  { scene: "baca-foto", label: "Baca foto" },
  { scene: "tunjuk", label: "Tunjuk" },
  { scene: "jawab", label: "Jawab" },
  { scene: "jawab-proses", label: "Jawab proses" },
  { scene: "belum-jelas", label: "Belum jelas" },
  { scene: "pilih", label: "Pilih" },
  { scene: "hati-hati", label: "Hati-hati" },
  { scene: "info", label: "Info" },
  { scene: "kursor", label: "Gerak kursor" },
];

/** The mock AlurSekolah's Isi nilai page (apps/mock-alursekolah), where the targets live. */
const KELAS = "#pilih-kelas";
const TAMPILKAN = "#btn-tampilkan";

/** The element a scene points at, or null for the ones that sit above the Nemu button. */
export function sceneTargetSelector(scene: PreviewScene, step: number): string | null {
  if (scene === "kerja") return KELAS;
  if (scene === "tunjuk") return TAMPILKAN;
  if (scene === "kursor") return step % 2 === 0 ? KELAS : TAMPILKAN;
  return null;
}

type SceneActions = { slow: boolean; toggleSlow: () => void; close: () => void };

/** Sample content for each scene, in the words the mock AlurSekolah uses. */
export function sceneDisplay(
  scene: PreviewScene,
  step: number,
  actions: SceneActions,
): NemuDisplay {
  switch (scene) {
    case "kerja":
      return {
        type: "kerja",
        status: { tone: "working", text: "Nemu mengisi", progress: { done: 13, total: 32 } },
        sentence: "Nemu mengisi nilai Aisyah Putri Wijaya: 85.",
        detail: "Klik atau ketik kalau Ibu mau isi sendiri.",
        slow: actions.slow,
        onSlow: actions.toggleSlow,
        onStop: actions.close,
      };
    case "baca-foto":
      // No onSlow: reading a photo can't go slower, so there is only Berhenti.
      return {
        type: "kerja",
        status: { text: "Nemu membaca foto" },
        sentence: "Sebentar, Bu. Saya baca 32 nilai.",
        detail: "Biasanya kurang dari 1 menit.",
        onStop: actions.close,
      };
    case "tunjuk":
      return {
        type: "tunjuk",
        status: { text: "Giliran Ibu" },
        sentence: "Sekarang tekan Tampilkan Siswa.",
        detail: "Nemu menunggu sampai daftar murid muncul.",
        note: { kenapa: "Daftar murid kelas 4A muncul setelah tombol ini ditekan." },
        chip: "Belum tersimpan",
        cancel: { label: "Batal, biar Ibu sendiri", onSelect: actions.close },
      };
    case "kursor":
      return {
        type: "tunjuk",
        sentence:
          step % 2 === 0 ? "Pilih kelas 4A di sini." : "Lalu tekan Tampilkan Siswa di sini.",
      };
    case "jawab":
      return {
        type: "jawab",
        status: { text: "Jawaban" },
        sentence: "KKM semua mata pelajaran di SDIT Nusantara adalah 75.",
        detail: "Berlaku untuk semester ganjil 2026/2027.",
        notes: {
          kenapa: "Sekolah menetapkan satu KKM untuk semua mata pelajaran tahun ini.",
          sumber: ["SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2"],
          ringkasan: "Nilai di bawah 75 perlu remedial sebelum rapor dikunci.",
        },
        action: { label: "Buka Rekap Nilai", onSelect: actions.close },
        onClose: actions.close,
      };
    case "jawab-proses":
      // Kenapa? and Sumber open as their own card with Tutup (F2 · 03, F2 · 06).
      return {
        type: "jawab",
        status: { text: "Jawaban" },
        sentence: "Bukan kesalahan Ibu. Kemungkinan karena alur SPP sekolah.",
        detail: "Nilai UTS Aisyah sudah tersimpan.",
        notes: {
          kenapa:
            "Di alur SPP sekolah, nilai dikunci selama tagihan lewat jatuh tempo, dan terbuka lagi setelah lunas.",
          sumber: [
            "Tagihan SPP lewat jatuh tempo.",
            "Sistem mengunci nilai di aplikasi orang tua.",
            "Nilai terbuka lagi setelah tagihan lunas.",
          ],
          sumberSteps: true,
          sumberName: "Alur SPP sekolah",
          sumberTitle: "Kenapa nilai bisa belum tampil?",
          sumberNote: "Nemu tidak bisa melihat status tagihan. Pastikan ke bagian keuangan.",
          sumberLink: { label: "Lihat diagram (operator)", href: "#/nilai" },
        },
        action: { label: "Siapkan balasan", onSelect: actions.close },
        onClose: actions.close,
      };
    case "belum-jelas":
      return {
        type: "jawab",
        status: { tone: "danger", text: "Belum jelas" },
        sentence: "Maaf, Bu. Nemu belum dengar jelas.",
        detail:
          'Terdengar: "...nilai... foto..." Tahan Ctrl + Spasi lagi, lalu ulangi lebih dekat.',
        onClose: actions.close,
      };
    case "hati-hati":
      return {
        type: "pilih",
        status: { tone: "warning", text: "Hati-hati", count: "UTS Matematika 4B" },
        question: "Rekap nilai ini sudah dikunci. Kalau dibuka, nilainya bisa berubah.",
        choices: [
          { id: "buka", label: "Buka kunci rekap", risky: true },
          { id: "biarkan", label: "Biarkan terkunci" },
        ],
        onChoose: actions.close,
      };
    case "pilih":
      return {
        type: "pilih",
        status: { tone: "muted", text: "Nemu berhenti", count: "13 dari 32" },
        question: "Nilai Bagas Pratama 58, di bawah KKM 75. Tetap simpan?",
        detail: "Pilih salah satu, Nemu menunggu.",
        choices: [
          { id: "simpan", label: "Tetap simpan", risky: true },
          { id: "periksa", label: "Periksa dulu" },
        ],
        onChoose: actions.close,
      };
    case "info":
      return {
        type: "info",
        status: { tone: "success", text: "Sudah dicek" },
        title: "Tersimpan, sama dengan buku.",
        detail: "32 nilai Harian Matematika 4B sudah Nemu baca ulang.",
        itemsLabel: "Catatan langkah · Cara isi nilai kelas",
        items: [
          "Menu Nilai",
          "Pilih kelas, mapel, penilaian",
          "Ketik nilai per murid",
          "Tekan Simpan",
        ],
        link: { label: "Coba sendiri", onSelect: actions.close },
        onClose: actions.close,
      };
  }
}
