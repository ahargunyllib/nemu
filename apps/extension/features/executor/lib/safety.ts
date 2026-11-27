import { isDeniedActionName } from "@nemu/ai/school/safety";
import {
  type ExecutorStep,
  executorStepSchema,
  executorTargetSchema,
  type ExecutorTask,
  type UntrustedTask,
} from "@nemu/contracts/executor";

import { accessibleName } from "./find-target";
import { cleanValue } from "./page-actions";

/**
 * The executor's own safety rules (F0-07, F0-08). They hold whatever the AI, a recording or a
 * fixture asks for: forbidden buttons are refused, nothing is submitted, and the teacher's own
 * mouse or keyboard stops Nemu.
 */

/** Why the executor points at a target instead of acting on it. */
export type Refusal = "denied_name" | "submits_form" | "not_allowed_verb";

/** The verbs that change the page. `point` and `scroll` only show something. */
const ACTING_VERBS: ReadonlySet<ExecutorStep["verb"]> = new Set([
  "setValue",
  "selectOption",
  "check",
  "clickMenu",
]);

/** Whether pressing the element would submit a form (a submit button, or a button in a form). */
function submitsForm(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return element.type === "submit" && !!element.form;
  if (element instanceof HTMLInputElement)
    return (element.type === "submit" || element.type === "image") && !!element.form;
  return false;
}

/**
 * F0-08: Nemu never acts on Simpan, Kirim, Ajukan, Hapus and the like (`isDeniedActionName`, on
 * every target), and never presses anything that would submit a form.
 */
export function refusalFor(step: ExecutorStep, element: Element): Refusal | null {
  if (!ACTING_VERBS.has(step.verb)) return null;
  const names = [accessibleName(element), element.textContent ?? ""];
  if (names.some((name) => isDeniedActionName(name))) return "denied_name";
  if ((step.verb === "clickMenu" || step.verb === "check") && submitsForm(element))
    return "submits_form";
  return null;
}

/**
 * Checks a task from the AI or a file before anything runs. A step with a verb outside the
 * allowed six (a "click", "submit" or "pressKey") becomes pointing at its target, and its index
 * is returned in `refused`; a step without a usable target is dropped. Values lose line breaks.
 */
export function toSafeTask(untrusted: UntrustedTask): { task: ExecutorTask; refused: number[] } {
  const steps: ExecutorStep[] = [];
  const refused: number[] = [];
  for (const raw of untrusted.steps) {
    const parsed = executorStepSchema.safeParse(raw);
    if (parsed.success) {
      const step = parsed.data;
      steps.push(step.verb === "setValue" ? { ...step, value: cleanValue(step.value) } : step);
      continue;
    }
    const target = executorTargetSchema.safeParse(raw.target);
    if (!target.success) continue;
    refused.push(steps.length);
    steps.push({ verb: "point", target: target.data, sentence: "" });
  }
  return {
    task: {
      kind: untrusted.kind,
      title: untrusted.title,
      ...(untrusted.source ? { source: untrusted.source } : {}),
      steps,
    },
    refused,
  };
}

/** The parts of a DOM event the input guard reads, so tests can pass plain objects. */
export type PageInput = {
  type: string;
  isTrusted: boolean;
  key?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  composedPath(): EventTarget[];
};

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

/**
 * F0-07: a real mouse press or key press from the teacher, on the page and not on Nemu's own
 * bubble. Modifier keys and the talk combination (Ctrl + Space) are not input: holding them pauses
 * Nemu through voice instead.
 */
export function isTeacherInput(event: PageInput, nemuHost: Element | null): boolean {
  if (!event.isTrusted) return false;
  if (!["mousedown", "pointerdown", "touchstart", "keydown"].includes(event.type)) return false;
  if (nemuHost && event.composedPath().includes(nemuHost)) return false;
  if (event.type === "keydown") {
    if (event.key && MODIFIER_KEYS.has(event.key)) return false;
    if (event.key === " " && (event.ctrlKey || event.altKey || event.metaKey)) return false;
  }
  return true;
}

/**
 * F0-08: while Nemu acts, every submit is cancelled, so neither a page script reacting to Nemu's
 * input nor an untrusted event can send the form. Returns the uninstaller.
 */
export function guardSubmits(doc: Document, isActing: () => boolean): () => void {
  const cancel = (event: Event) => {
    if (!event.isTrusted || isActing()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  doc.addEventListener("submit", cancel, true);
  return () => doc.removeEventListener("submit", cancel, true);
}
