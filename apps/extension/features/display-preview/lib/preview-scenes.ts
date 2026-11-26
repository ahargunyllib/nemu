import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

/**
 * Dev-only preview of the five display types and the Nemu cursor (#201), so they can be reviewed
 * on the mock AlurSekolah without the AI. Open an allowed page of a dev build with
 * `?pratinjau-nemu`, e.g. http://localhost:3003/?pratinjau-nemu#/nilai.
 */
export const PREVIEW_ENABLED =
  import.meta.env.DEV && new URLSearchParams(location.search).has("pratinjau-nemu");

export type PreviewScene = "kerja" | "tunjuk" | "jawab" | "pilih" | "info" | "kursor";

export const PREVIEW_SCENES: readonly { scene: PreviewScene; label: string }[] = [
  { scene: "kerja", label: "Kerja" },
  { scene: "tunjuk", label: "Tunjuk" },
  { scene: "jawab", label: "Jawab" },
  { scene: "pilih", label: "Pilih" },
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
        slow: actions.slow,
        onSlow: actions.toggleSlow,
        onStop: actions.close,
      };
    case "tunjuk":
      return {
        type: "tunjuk",
        status: { tone: "unsaved", text: "Belum tersimpan" },
        sentence: "Sekarang tekan Tampilkan Siswa.",
        note: { kenapa: "Daftar murid kelas 4A muncul setelah tombol ini ditekan." },
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
        status: { tone: "saved", text: "Tersimpan" },
        sentence: "KKM semua mata pelajaran di SDIT Nusantara adalah 75.",
        notes: {
          kenapa: "Sekolah menetapkan satu KKM untuk semua mata pelajaran tahun ini.",
          sumber: ["SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2"],
          ringkasan: "Nilai di bawah 75 perlu remedial sebelum rapor dikunci.",
        },
        action: { label: "Buka Rekap Nilai", onSelect: actions.close },
        onClose: actions.close,
      };
    case "pilih":
      return {
        type: "pilih",
        question: "Nilai Bagas Pratama 58, di bawah KKM 75. Tetap simpan?",
        choices: [
          { id: "simpan", label: "Tetap simpan", risky: true },
          { id: "periksa", label: "Periksa dulu" },
        ],
        onChoose: actions.close,
      };
    case "info":
      return {
        type: "info",
        title: "Catatan langkah",
        items: [
          "32 nilai Harian Matematika 4B diisi Nemu.",
          "Ibu menekan Simpan pukul 09.12.",
          "2 nilai di bawah KKM: Bagas Pratama, Fatih Rizky Wijaya.",
        ],
        onClose: actions.close,
      };
  }
}
