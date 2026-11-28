import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";
import type { GradeEntry } from "@nemu/contracts/school";

/** The grades the teacher asked for: "masukkan nilai UTS Matematika 4B". */
export type GradeTarget = { className: string; subject: string; assessment: string };

/** Every F1 run is this kind, so "Coba sendiri" and the read-back finisher find it. */
export const GRADE_TASK_KIND = "f1-isi-nilai";

/** The note beside a grade: below KKM, or absent (S/I/A, left blank by the school's rule). */
export const REMEDIAL_NOTE = "remedial";
export const ABSENT_NOTE = "tidak hadir";

/** "Ibu" / "Bapak" in a full sentence, from WS-06's "Bu" / "Pak". */
export function addressFor(honorific: string): string {
  if (honorific === "Bu") return "Ibu";
  if (honorific === "Pak") return "Bapak";
  return honorific || "Anda";
}

/**
 * The option AlurSekolah's Jenis Penilaian shows for what the teacher said: UTS and UAS as they
 * are, an ulangan harian (and a tugas or PR) as Harian.
 */
export function formAssessment(assessment: string): string {
  const kind = assessment.split(/\s+/u)[0]?.toUpperCase() ?? "";
  if (kind === "UTS" || kind === "UAS") return kind;
  return "Harian";
}

export function noteFor(entry: GradeEntry): string | null {
  if (entry.status === "S" || entry.status === "I" || entry.status === "A") return ABSENT_NOTE;
  if (entry.remedial) return REMEDIAL_NOTE;
  return null;
}

/** "Ahmad Fadli 82, …, Putra Wijaya kosong (tidak hadir)": the numbers behind Lihat ringkasan. */
export function gradeSummary(summarySentence: string, entries: readonly GradeEntry[]): string {
  const lines = entries.map((entry) => {
    const note = noteFor(entry);
    return `${entry.name} ${entry.value ?? "kosong"}${note ? ` (${note})` : ""}`;
  });
  return `${summarySentence} ${lines.join(", ")}.`;
}

/**
 * The cara 1 task for Isi nilai kelas (F1-08/09). Nemu opens it through the menu (visible
 * navigation), picks the class, subject and assessment, shows the students, then fills each
 * student's Nilai and, where needed, Catatan, found by the student's row and the column's
 * header, so the same steps work on any grade table with those labels. It ends pointing at
 * Simpan, which only the teacher presses.
 */
export function gradeTask(input: {
  command: GradeTarget;
  entries: readonly GradeEntry[];
  summarySentence: string;
  honorific: string;
}): ExecutorTask {
  const { command, entries } = input;
  const open: ExecutorStep[] = [
    { verb: "clickMenu", target: { role: "link", text: "Nilai" } },
    { verb: "selectOption", target: { label: "Kelas" }, option: command.className },
    { verb: "selectOption", target: { label: "Mata Pelajaran" }, option: command.subject },
    {
      verb: "selectOption",
      target: { label: "Jenis Penilaian" },
      option: formAssessment(command.assessment),
    },
    { verb: "clickMenu", target: { role: "button", text: "Tampilkan Siswa" } },
  ];
  const fill = entries.flatMap((entry): ExecutorStep[] => {
    const value: ExecutorStep = {
      verb: "setValue",
      target: { row: entry.name, column: "Nilai", role: "textbox" },
      value: entry.value === null ? "" : String(entry.value),
      rowName: entry.name,
    };
    const note = noteFor(entry);
    if (!note) return [value];
    return [
      value,
      {
        verb: "setValue",
        target: { row: entry.name, column: "Catatan", role: "textbox" },
        value: note,
      },
    ];
  });
  const save: ExecutorStep = {
    verb: "point",
    target: { role: "button", text: "Simpan" },
    sentence: `Silakan ${addressFor(input.honorific)} tekan Simpan.`,
    ringkasan: gradeSummary(input.summarySentence, entries),
  };
  return {
    kind: GRADE_TASK_KIND,
    title: `Isi nilai ${command.assessment} ${command.subject} ${command.className}`,
    source: "Foto buku nilai dari WhatsApp",
    steps: [...open, ...fill, save],
  };
}
