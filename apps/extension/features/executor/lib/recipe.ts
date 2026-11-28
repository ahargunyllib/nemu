import type { KartuInfoProps } from "@nemu/ui/lib/nemu-display";

/**
 * Step notes as a numbered recipe (DECISIONS 3, F3·08): after Nemu checked what was saved, the
 * Kartu Info says so ("Sudah dicek") and lists how the task is done, so the teacher can do it
 * herself next time ("Coba sendiri"). Any flow with a read-back can build its card here: F3 now;
 * F1 and F4 can follow with their own steps.
 */

/** The heading, title, detail and list label of the card that shows the step notes. */
export type NotesCard = Pick<KartuInfoProps, "status" | "title" | "detail" | "itemsLabel">;

/** "Cara catat hafalan tahfidz": the recipe's name from the task's name. */
export function recipeName(task: string): string {
  return `Cara ${task.trim().toLocaleLowerCase("id-ID")}`;
}

/**
 * The card after a check. `checked` is what the read-back found: all as written ("Setoran 3
 * murid tersimpan, sama dengan buku.") or not. Its list is the recipe, under "Catatan langkah ·
 * Cara …".
 */
export function recipeCard(input: {
  checked: { ok: boolean; title: string };
  detail?: string;
  /** The task's name, as in "Cara catat setoran". */
  recipe: string;
}): NotesCard {
  return {
    status: input.checked.ok
      ? { tone: "success", text: "Sudah dicek" }
      : { tone: "danger", text: "Belum sama" },
    title: input.checked.title,
    ...(input.detail ? { detail: input.detail } : {}),
    itemsLabel: `Catatan langkah · ${recipeName(input.recipe)}`,
  };
}
