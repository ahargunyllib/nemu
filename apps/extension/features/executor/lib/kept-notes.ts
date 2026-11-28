import type { StepNotes } from "../api/request-run-storage";

/** How many Catatan langkah a site keeps for the Nemu button ("Catatan langkah · 3 tersimpan"). */
export const KEPT_NOTES = 5;

/**
 * The site's kept notes with `next` added: newest first, one per recipe (a second "Cara isi nilai
 * kelas" replaces the first), at most `KEPT_NOTES`.
 */
export function withNotes(kept: readonly StepNotes[], next: StepNotes): StepNotes[] {
  return [next, ...kept.filter((notes) => notes.title !== next.title)].slice(0, KEPT_NOTES);
}
