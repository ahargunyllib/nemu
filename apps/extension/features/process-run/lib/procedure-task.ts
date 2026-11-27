import type { ExecutorStep, ExecutorTarget, ExecutorTask, TargetRole } from "@nemu/contracts/executor";
import type { Procedure } from "@nemu/contracts/school";

import { addressFor } from "../../grade-photo/lib/grade-task";

/**
 * F3-01 replay (#214): a recorded procedure, with the teacher's values filled in, as one executor
 * task. Clicks open menus and buttons by the name they had when recorded; fields are found by
 * their label. The step only the teacher does (Simpan, Kirim, Hapus) is pointed at, with where it
 * came from behind Sumber: "Rekaman Pak Rizal, langkah 11 dari 11".
 */

/** Every replay is this kind, so "Lain kali coba sendiri" groups them. */
export const PROCEDURE_TASK_KIND = "f3-rekaman";

type RunStep = Procedure["steps"][number] & { value: string | null };

const ROLES = new Set<TargetRole>(["textbox", "combobox", "checkbox", "radio", "button", "link", "menuitem", "tab"]);

function targetOf(step: RunStep, fallback?: TargetRole): ExecutorTarget {
  const name = step.locator.label ?? step.locator.name ?? step.locator.placeholder ?? "";
  const role = step.locator.role && ROLES.has(step.locator.role as TargetRole)
    ? (step.locator.role as TargetRole)
    : fallback;
  if (step.action === "click") return { text: name, ...(role ? { role } : {}) };
  return { label: name, ...(role ? { role } : {}) };
}

export function sourceLine(recordedBy: string | null): string {
  return recordedBy ? `Rekaman ${recordedBy}` : "Rekaman sekolah";
}

export function procedureTask(input: {
  title: string;
  recordedBy: string | null;
  steps: readonly RunStep[];
  honorific: string;
}): ExecutorTask {
  const total = input.steps.length;
  const source = sourceLine(input.recordedBy);
  const steps = input.steps.flatMap((step): ExecutorStep[] => {
    if (step.action === "navigate") return [];
    if (step.requiresHumanAction) {
      const name = step.locator.name ?? step.locator.label ?? "tombol ini";
      return [
        {
          verb: "point",
          target: targetOf(step, "button"),
          sentence: `Silakan ${addressFor(input.honorific)} tekan ${name}.`,
          sumber: `${source}, langkah ${step.order} dari ${total}`,
        },
      ];
    }
    if (step.action === "click") return [{ verb: "clickMenu", target: targetOf(step) }];
    if (step.action === "select")
      return [{ verb: "selectOption", target: targetOf(step, "combobox"), option: step.value ?? "" }];
    return [{ verb: "setValue", target: targetOf(step, "textbox"), value: step.value ?? "" }];
  });
  return { kind: PROCEDURE_TASK_KIND, title: input.title, source, steps };
}
