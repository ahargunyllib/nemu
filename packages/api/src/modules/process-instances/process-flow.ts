import { DEMO_HOLIDAYS_2026 } from "@nemu/ai/demo";
import { calculateAccountabilityDeadline } from "@nemu/ai/tools";
import type { ProcessState } from "@nemu/contracts/process-instance";

export type TaskKey = "isi_rencana" | "revisi" | "pertanggungjawaban";

/** The work item a Process Instance asks of its owner; `id` is shown as the task ID. */
export type ProcessTask = { id: string; key: TaskKey; label: string };

// Only these States wait on the employee; the others wait on the atasan, PPK, or bendahara.
const TASK_OF_STATE: Partial<Record<ProcessState, { key: TaskKey; label: string; code: string }>> =
  {
    Draf: { key: "isi_rencana", label: "Isi rencana perjalanan", code: "RN" },
    Revisi: { key: "revisi", label: "Perbaiki pengajuan", code: "RV" },
    Pertanggungjawaban: { key: "pertanggungjawaban", label: "Pertanggungjawaban", code: "PJ" },
  };

export function activeTaskOf(instance: { id: string; state: ProcessState }): ProcessTask | null {
  const task = TASK_OF_STATE[instance.state];
  return task ? { id: `${task.code}-${instance.id}`, key: task.key, label: task.label } : null;
}

const MAIN_PATH: readonly ProcessState[] = [
  "Draf",
  "Diajukan",
  "Disetujui",
  "Berangkat",
  "Kembali",
  "Pertanggungjawaban",
  "Verifikasi",
  "Selesai",
];

/** The State the demo panel moves to next; a Revisi goes back to Diajukan, Selesai is the end. */
export function nextState(state: ProcessState): ProcessState | null {
  if (state === "Revisi") return "Diajukan";
  return MAIN_PATH[MAIN_PATH.indexOf(state) + 1] ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nights away, e.g. 3–5 November is 2 nights. */
export function nightsBetween(tanggalBerangkat: string, tanggalKembali: string): number {
  return Math.round(
    (Date.parse(`${tanggalKembali}T00:00:00Z`) - Date.parse(`${tanggalBerangkat}T00:00:00Z`)) /
      DAY_MS,
  );
}

/** When a Task opened and when it falls due, as YYYY-MM-DD days. */
export type TaskDates = { openedOn: string; dueOn: string };

/** Days a Task other than Pertanggungjawaban has before it falls due. */
const TASK_DUE_DAYS = 7;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * When a Task opened and falls due, against the demo clock's `today`.
 *
 * Pertanggungjawaban opens when the trip ends and falls due on the batas pertanggungjawaban:
 * 5 working days after `tanggalKembali`, counted by the AI's own `batas_pertanggungjawaban` on the
 * same holidays, so the Demo App and Nemu agree. The demo keeps no due date for the other Tasks, so
 * they open today and get a week.
 */
export function taskDatesOf(
  key: TaskKey,
  instance: { tanggalKembali: string },
  today: string,
): TaskDates {
  if (key === "pertanggungjawaban") {
    return {
      openedOn: instance.tanggalKembali,
      dueOn: String(
        calculateAccountabilityDeadline(instance.tanggalKembali, DEMO_HOLIDAYS_2026).hasil,
      ),
    };
  }
  return { openedOn: today, dueOn: addDays(today, TASK_DUE_DAYS) };
}
