import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";

import type { StepSource } from "./run";

/**
 * Dev-only tasks on the mock AlurSekolah's Isi nilai kelas page, to try each cara without the AI
 * (`?uji-nemu`). F1 (#207) builds the real ones from the grade-book photo.
 */
const OPEN_GRADES: ExecutorStep[] = [
  { verb: "clickMenu", target: { role: "link", text: "Nilai" } },
  { verb: "selectOption", target: { label: "Kelas" }, option: "4B" },
  { verb: "selectOption", target: { label: "Mata Pelajaran" }, option: "Matematika" },
  { verb: "selectOption", target: { label: "Jenis Penilaian" }, option: "UTS" },
  { verb: "clickMenu", target: { role: "button", text: "Tampilkan Siswa" } },
];

const GRADES: readonly [string, string][] = [
  ["Ahmad Fadli", "80"],
  ["Aisyah Zahra", "92"],
  ["Alya Nur Fitri", "77"],
  ["Bagas Saputra", "68"],
  ["Budi Santoso", "85"],
];

const FILL: ExecutorStep[] = [
  ...GRADES.map(([name, value]): ExecutorStep => ({
    verb: "setValue",
    target: { label: `Nilai ${name}` },
    value,
    rowName: name,
  })),
  { verb: "setValue", target: { label: "Catatan Bagas Saputra" }, value: "remedial" },
  { verb: "point", target: { role: "button", text: "Simpan" }, sentence: "Silakan tekan Simpan." },
];

export const SAMPLE_GRADE_TASK: ExecutorTask = {
  kind: "uji-isi-nilai",
  title: "Isi nilai UTS Matematika 4B (contoh)",
  steps: [...OPEN_GRADES, ...FILL],
};

/** F0-09: the second half comes from a source that fails three times, then answers. */
export const SAMPLE_OFFLINE_TASK: ExecutorTask = {
  kind: "uji-koneksi",
  title: "Isi nilai UTS Matematika 4B (koneksi putus)",
  steps: OPEN_GRADES,
};

export function flakySource(failures: number): StepSource {
  let left = failures;
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (left > 0) {
      left -= 1;
      throw new Error("Koneksi terputus (uji)");
    }
    return { steps: FILL, continuation: null };
  };
}
