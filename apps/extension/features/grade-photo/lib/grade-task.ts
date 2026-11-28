import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";
import type { GradeEntry } from "@nemu/contracts/school";

/** The grades the teacher asked for: "masukkan nilai UTS Matematika 4B". */
export type GradeTarget = { className: string; subject: string; assessment: string };

/** Every F1 run is this kind, so "Coba sendiri" and the read-back finisher find it. */
export const GRADE_TASK_KIND = "f1-isi-nilai";

/** The note beside a grade: below KKM, or absent (S/I/A, left blank by the school's rule). */
export const REMEDIAL_NOTE = "remedial";
export const ABSENT_NOTE = "tidak hadir";

/** What Catatan langkah calls F1's job: "Cara isi nilai kelas". */
export const GRADE_RECIPE = "Isi nilai kelas";

const ABSENT_WORD = { S: "sakit", I: "izin", A: "alpa" } as const;

function joinNames(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} dan ${names.at(-1)}`;
}

/**
 * The detail line under "Tersimpan, sama dengan buku." (F1·12): how many grades Nemu read back
 * and who was left blank, by first name: "31 nilai sudah Nemu baca ulang. Raka dikosongkan
 * (sakit)."
 */
export function readBackDetail(entries: readonly GradeEntry[]): string {
  const read = entries.filter((entry) => entry.value !== null).length;
  const absent = entries.flatMap((entry) =>
    entry.status === "S" || entry.status === "I" || entry.status === "A"
      ? [{ name: entry.name.split(/\s+/u)[0] ?? entry.name, why: ABSENT_WORD[entry.status] }]
      : [],
  );
  const lines = [`${read} nilai sudah Nemu baca ulang.`];
  const reasons = [...new Set(absent.map((entry) => entry.why))];
  if (reasons.length === 1)
    lines.push(`${joinNames(absent.map((entry) => entry.name))} dikosongkan (${reasons[0]}).`);
  else if (reasons.length > 1)
    lines.push(`${joinNames(absent.map((entry) => `${entry.name} (${entry.why})`))} dikosongkan.`);
  return lines.join(" ");
}

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

/** The recipe's lines (Catatan langkah · Cara isi nilai kelas): the plan's four stages. */
const STAGE = {
  menu: "Menu Nilai",
  pick: "Pilih kelas, mapel, penilaian",
  fill: "Ketik nilai per murid",
  save: "Tekan Simpan",
} as const;

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
    { verb: "clickMenu", stage: STAGE.menu, target: { role: "link", text: "Nilai" } },
    {
      verb: "selectOption",
      stage: STAGE.pick,
      target: { label: "Kelas" },
      option: command.className,
    },
    {
      verb: "selectOption",
      stage: STAGE.pick,
      target: { label: "Mata Pelajaran" },
      option: command.subject,
    },
    {
      verb: "selectOption",
      stage: STAGE.pick,
      target: { label: "Jenis Penilaian" },
      option: formAssessment(command.assessment),
    },
    {
      verb: "clickMenu",
      stage: STAGE.pick,
      target: { role: "button", text: "Tampilkan Siswa" },
    },
  ];
  const fill = entries.flatMap((entry): ExecutorStep[] => {
    const value: ExecutorStep = {
      verb: "setValue",
      stage: STAGE.fill,
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
        stage: STAGE.fill,
        target: { row: entry.name, column: "Catatan", role: "textbox" },
        value: note,
      },
    ];
  });
  const save: ExecutorStep = {
    verb: "point",
    stage: STAGE.save,
    target: { role: "button", text: "Simpan" },
    sentence: `Silakan ${addressFor(input.honorific)} tekan Simpan.`,
    ringkasan: gradeSummary(input.summarySentence, entries),
  };
  return {
    kind: GRADE_TASK_KIND,
    title: `Isi nilai ${command.assessment} ${command.subject} ${command.className}`,
    source: "Foto buku nilai dari WhatsApp",
    recipe: { name: GRADE_RECIPE, from: `pengisian ${command.subject} ${command.className}` },
    steps: [...open, ...fill, save],
  };
}
