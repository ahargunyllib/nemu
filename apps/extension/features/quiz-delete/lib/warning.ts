import type { KartuPilihProps } from "@nemu/ui/lib/nemu-display";

/** F4-06's choices (#211): keeping the quiz is the safe one and comes first. */
export const KEEP = "Jangan hapus";
export const SHOW = "Tunjukkan tombol Hapus";
export const NOTHING_DELETED = "Nemu tidak menekan Hapus; Nemu hanya menunjuknya.";

/** The warning, word for word as F4-3 expects it. */
export function warning(count: number): string {
  return count > 0
    ? `Kuis ini sudah dikerjakan ${count} siswa. Kalau dihapus, nilainya ikut terhapus.`
    : "Kuis ini belum dikerjakan siswa.";
}

/** Kartu Pilih: the count, "Jangan hapus", then "Tunjukkan tombol Hapus" with ⚠ under it. */
export function warningCard(
  count: number,
  onChoose: (id: "jangan" | "tunjukkan") => void,
): KartuPilihProps {
  return {
    question: warning(count),
    choices: [
      { id: "jangan", label: KEEP },
      { id: "tunjukkan", label: SHOW, risky: true },
    ],
    onChoose: (id) => onChoose(id === "jangan" ? "jangan" : "tunjukkan"),
  };
}
