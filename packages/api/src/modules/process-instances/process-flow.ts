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
