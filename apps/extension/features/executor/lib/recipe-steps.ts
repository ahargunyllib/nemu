import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";

import { describeTarget } from "./find-target";
import { type NotesCard, recipeCard, recipeName } from "./recipe";
import type { RunState } from "./run";

/**
 * Catatan langkah as a numbered recipe (F1·12): how the job is done, so the teacher can do it
 * herself next time ("Coba sendiri"), not an audit of who pressed what. The lines come from the
 * run's plan: each stage the plan names, in order, once ("Menu Nilai", "Pilih kelas, mapel,
 * penilaian", "Ketik nilai per murid", "Tekan Simpan"). A step whose plan names no stage gets a
 * plain line from its verb, and steps of one kind in a row share a line. The audit trail stays in
 * the action log (WS-10) and in the kept notes' `log`, never in the card.
 */

/** A recipe as it is kept and shown: "Cara isi nilai kelas", where it came from, its lines. */
export type Recipe = {
  /** "Cara isi nilai kelas" */
  title: string;
  /** "Disimpan dari pengisian Matematika 4B, 1 Des 2026." */
  subtitle: string;
  items: string[];
};

/** The plain line for a step without a stage, and what makes two steps share one. */
function plainLine(step: ExecutorStep): { key: string; line: (names: string[]) => string } | null {
  const name = describeTarget(step.target);
  switch (step.verb) {
    case "point":
      return { key: `point:${name}`, line: () => `Tekan ${name}` };
    case "clickMenu":
      return { key: `menu:${name}`, line: () => `Buka ${name}` };
    case "selectOption":
      return { key: "select", line: (names) => `Pilih ${names.join(", ")}` };
    case "check":
      return step.checked
        ? { key: "check", line: (names) => `Centang ${names.join(", ")}` }
        : { key: "uncheck", line: (names) => `Hapus centang ${names.join(", ")}` };
    case "setValue":
      // A field in each student's row: one line for the whole column.
      if (step.target.row) {
        const column = (step.target.column ?? "nilai").toLocaleLowerCase("id-ID");
        return { key: `rows:${column}`, line: () => `Isi ${column} per baris` };
      }
      return { key: "fill", line: (names) => `Isi ${names.join(", ")}` };
    case "scroll":
      return null;
  }
}

/** The recipe's lines: the plan's stages in order, once each; plain lines for the rest. */
export function recipeItems(steps: readonly ExecutorStep[]): string[] {
  type Group = { key: string; names: string[]; line: (names: string[]) => string };
  const lines: (string | Group)[] = [];
  for (const step of steps) {
    const last = lines.at(-1);
    if (step.stage) {
      lines.push(step.stage);
      continue;
    }
    const plain = plainLine(step);
    if (!plain) continue;
    const name = describeTarget(step.target);
    if (typeof last === "object" && last.key === plain.key) {
      if (!last.names.includes(name)) last.names.push(name);
      continue;
    }
    lines.push({ key: plain.key, names: [name], line: plain.line });
  }
  const items = lines.map((line) => (typeof line === "string" ? line : line.line(line.names)));
  return items.filter((item, index) => items.indexOf(item) === index);
}

/** "1 Des 2026" */
export function shortDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("id-ID") + text.slice(1);
}

/** The run's recipe: its job's name, where and when it was saved from, and its lines. */
export function recipeOf(task: ExecutorTask, savedAt: Date = new Date()): Recipe {
  // Saved from this run, else from where its steps came ("Kamus Kendala K-02"), else its title.
  const from = task.recipe?.from ?? task.source ?? lowerFirst(task.title);
  return {
    // A recording's or the AI's task without a name keeps its title's capitals: "Cara catat UTS".
    title: task.recipe ? recipeName(task.recipe.name) : `Cara ${lowerFirst(task.title)}`,
    subtitle: `Disimpan dari ${from}, ${shortDate(savedAt)}.`,
    items: recipeItems(task.steps),
  };
}

/**
 * `recipeCard` for a recipe already named (F4·11): "Sudah dicek" or "Belum sama", the check's
 * title and detail, and "Catatan langkah · Cara pasang kuis" above the steps.
 */
export function checkedCard(
  recipe: Recipe,
  checked: { ok: boolean; title: string },
  detail?: string,
): NotesCard {
  return {
    ...recipeCard({ checked, recipe: "", ...(detail ? { detail } : {}) }),
    itemsLabel: `Catatan langkah · ${recipe.title}`,
  };
}

/** Where a stopped run stopped, under the recipe: "Berhenti di langkah 3 dari 32. Isian tetap ada." */
export function stoppedDetail(state: Pick<RunState, "status" | "index" | "task">) {
  if (state.status !== "stopped") return undefined;
  const total = state.task.steps.length;
  return `Berhenti di langkah ${Math.min(state.index + 1, total)} dari ${total}. Isian tetap ada.`;
}
