/** WS-10: an action-log row in the words the operator reads. */
const ACTION_LABELS: Record<string, string> = {
  start: "Mulai tugas",
  finish: "Selesai",
  stop: "Berhenti",
  point: "Menunjuk",
  scroll: "Menggulir",
  setValue: "Mengisi",
  selectOption: "Memilih",
  check: "Mencentang",
  clickMenu: "Membuka menu",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export const RESULT_LABELS = {
  done: "Berhasil",
  refused: "Ditolak",
  teacher: "Dikerjakan guru",
  stopped: "Dihentikan",
  failed: "Gagal",
} as const;

export type ActionResult = keyof typeof RESULT_LABELS;
