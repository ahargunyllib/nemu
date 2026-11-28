import type { ExecutorStep, ExecutorTarget, ExecutorTask } from "@nemu/contracts/executor";

import { addressFor } from "../../grade-photo/lib/grade-task";
import {
  collapsedHeaderFor,
  coursePage,
  importResult,
  isImportForm,
  isNewQuizForm,
  legendOf,
  listedQuestions,
  optionText,
  pickedFile,
  quizModule,
} from "./moodle-course";
import { type ImportPlan, type SetTime, spokenTime } from "./plan";

/**
 * F4-03 as one executor task (#210), in cara 1: from the course page Nemu turns on Mode Edit,
 * adds a Kuis to the section, fills its name and times, and points at Simpan dan tampilkan, which
 * the teacher presses. Then it opens the quiz's own Bank soal › Impor, picks Moodle XML, drops the
 * XML file on the picker (or, if Moodle doesn't take it, saves it to Unduhan and points at Pilih
 * berkas), and points at Impor. Last, Soal › Tambah › dari bank soal, all of them ticked, and it
 * points at Tambahkan soal terpilih pada kuis. Every form submit is the teacher's press (F0-08);
 * each page is read when it arrives, so the steps come in parts and survive page loads (F0-13).
 */

export const QUIZ_IMPORT_KIND = "f4-masukkan-kuis";

type Phase =
  | "edit-mode"
  | "settings"
  | "saved"
  | "bank"
  | "import-form"
  | "drop"
  | "picking"
  | "imported"
  | "questions"
  | "added";

export type ImportContinuation = {
  phase: Phase;
  plan: ImportPlan;
  /** "Bu" or "Pak" as Nemu knew her when she asked. */
  honorific: string;
  /** The new quiz's course module, once it is saved. */
  cmid: number | null;
  /** Whether the drop took (the spike), or she picked the file herself; null before Impor. */
  dropped: boolean | null;
};

/** How the task ended, for the finisher on the last page. */
export type ImportOutcome =
  | { status: "added"; cmid: number; listed: number; dropped: boolean }
  | { status: "error"; message: string };

/** What the step source needs from the browser; tests pass their own. */
export type ImportIo = {
  doc: Document;
  url(): string;
  sleep(ms: number): Promise<void>;
  /** The spike: the file handed to Impor's picker as a drop (`dropFile`). */
  drop(file: File): void;
  /** The fallback: the XML saved to the teacher's Unduhan. */
  download(fileName: string, xml: string): void;
  /** Nemu says what it does between steps (the drop). */
  say(sentence: string): void;
};

/** How long a page may take to arrive after a menu click or the teacher's press. */
const ARRIVE_MS = 20_000;
/** How long the teacher may take to pick the file herself in Moodle's file dialog. */
const PICK_MS = 5 * 60_000;
/** How long Moodle may take to upload the dropped file. */
const DROP_MS = 10_000;
const POLL_MS = 250;

function clickMenu(target: ExecutorTarget): ExecutorStep {
  return { verb: "clickMenu", target };
}

function teacherOf(honorific: string): string {
  return honorific ? `, ${honorific}` : "";
}

/** The task from the course page, or null anywhere else. */
export function quizImportTask(
  doc: Document,
  url: string,
  plan: ImportPlan,
  honorific: string,
): { task: ExecutorTask; continuation: ImportContinuation } | null {
  const course = coursePage(doc, url);
  if (!course || course.courseId !== plan.courseId) return null;
  const continuation: ImportContinuation = {
    phase: "settings",
    plan,
    honorific,
    cmid: null,
    dropped: null,
  };
  const task = (steps: ExecutorStep[]): ExecutorTask => ({
    kind: QUIZ_IMPORT_KIND,
    title: `Masukkan kuis ${plan.name}`,
    source: `Naskah ${plan.fileName.replace(/\.xml$/u, "")}`,
    steps,
  });
  if (!course.editing)
    return {
      task: task([
        { verb: "check", target: { role: "checkbox", label: "Mode Edit" }, checked: true },
      ]),
      continuation: { ...continuation, phase: "edit-mode" },
    };
  return { task: task(addQuizSteps(plan)), continuation };
}

/**
 * In the section's Tambahkan konten: Aktivitas atau sumber daya, then in Moodle 5.3's chooser
 * the Semua tab (it opens on Bertanda bintang once she has starred something), Kuis (which only
 * selects it) and the chooser's own Tambahkan (a button outside any form).
 */
function addQuizSteps(plan: ImportPlan): ExecutorStep[] {
  return [
    clickMenu({ role: "button", label: `Masukkan konten di bagian '${plan.section}'` }),
    clickMenu({ role: "button", text: "Aktivitas atau sumber daya" }),
    clickMenu({ role: "tab", text: "Semua" }),
    clickMenu({ role: "link", text: "Kuis" }),
    clickMenu({ role: "button", text: "Tambahkan" }),
  ];
}

/** Aktifkan, then the day, month, year, hour and minute, in the group the form names. */
function timeSteps(doc: Document, field: "timeopen" | "timeclose", time: SetTime): ExecutorStep[] {
  const group = legendOf(doc, `id_${field}`, field === "timeopen" ? "Kuis dimulai" : "Tutup kuis");
  const [year = "", month = "", day = ""] = time.date.split("-");
  const [hour = "", minute = ""] = time.time.split(":");
  const select = (label: string, part: string, value: string): ExecutorStep => ({
    verb: "selectOption",
    target: { role: "combobox", label, group },
    option: optionText(doc, `id_${field}_${part}`, String(Number(value))),
  });
  return [
    { verb: "check", target: { role: "checkbox", label: "Aktifkan", group }, checked: true },
    select("Hari", "day", day),
    select("Bulan", "month", month),
    select("Tahun", "year", year),
    select("Jam", "hour", hour),
    select("Menit", "minute", minute),
  ];
}

/** Waits until `ready` holds on the page the last step opened; the old page may still show. */
async function arrive(io: ImportIo, ready: () => boolean, what: string, ms = ARRIVE_MS) {
  for (let waited = 0; ; waited += POLL_MS) {
    if (ready()) return;
    if (waited >= ms) throw new Error(`${what} didn't open`);
    await io.sleep(POLL_MS);
  }
}

function onQuizPage(io: ImportIo, cmid: number | null, path: string): boolean {
  const page = quizModule(io.doc, io.url());
  return !!page && page.path.endsWith(path) && (cmid === null || page.cmid === cmid);
}

/**
 * The step source (F0-09): reads the page the last step opened and gives the next steps. On the
 * quiz's Soal page with its questions in, it hands the outcome to `onDone`; the task then ends.
 */
export async function nextImportSteps(
  io: ImportIo,
  continuation: ImportContinuation,
  onDone: (outcome: ImportOutcome) => void,
): Promise<{ steps: ExecutorStep[]; continuation: ImportContinuation | null }> {
  const { plan, honorific } = continuation;
  const teacher = teacherOf(honorific);
  // Where she presses, Nemu asks: "Silakan Ibu tekan Impor."
  const press = (button: string) => `Silakan ${addressFor(honorific)} tekan ${button}.`;
  const next = (phase: Phase, more: Partial<ImportContinuation> = {}): ImportContinuation => ({
    ...continuation,
    ...more,
    phase,
  });
  const done = (outcome: ImportOutcome) => {
    onDone(outcome);
    return { steps: [], continuation: null };
  };
  const pointImport = (dropped: boolean) => ({
    steps: [
      {
        verb: "point" as const,
        target: { role: "button" as const, text: "Impor" },
        sentence: `${press("Impor")} Isinya ${plan.count} soal dari naskah.`,
        sumber: `Naskah ${plan.fileName.replace(/\.xml$/u, "")}`,
      },
    ],
    continuation: next("imported", { dropped }),
  });

  switch (continuation.phase) {
    case "edit-mode": {
      await arrive(io, () => !!coursePage(io.doc, io.url())?.editing, "The course in Mode Edit");
      return { steps: addQuizSteps(plan), continuation: next("settings") };
    }
    case "settings": {
      await arrive(io, () => isNewQuizForm(io.doc, io.url()), "The new quiz's form");
      const timing = collapsedHeaderFor(io.doc, "id_timeopen");
      const steps: ExecutorStep[] = [
        { verb: "setValue", target: { role: "textbox", label: "Nama" }, value: plan.name },
        ...(timing ? [clickMenu({ role: "button", text: timing })] : []),
        ...timeSteps(io.doc, "timeopen", plan.opens),
        ...timeSteps(io.doc, "timeclose", plan.closes),
        {
          verb: "point",
          target: { role: "button", text: "Simpan dan tampilkan" },
          sentence: press("Simpan dan tampilkan"),
          ringkasan: `${plan.name} di bagian ${plan.section}: dibuka ${spokenTime(plan.opens)}, ditutup ${spokenTime(plan.closes)}.`,
        },
      ];
      return { steps, continuation: next("saved") };
    }
    case "saved": {
      await arrive(io, () => onQuizPage(io, null, "/mod/quiz/view.php"), "The new quiz's page");
      const cmid = quizModule(io.doc, io.url())!.cmid;
      return {
        steps: [clickMenu({ role: "link", text: "Bank soal" })],
        continuation: next("bank", { cmid }),
      };
    }
    case "bank": {
      await arrive(
        io,
        () =>
          onQuizPage(io, continuation.cmid, "/question/edit.php") &&
          !!io.doc.querySelector("#tertiary-navigation [role=combobox]"),
        "The quiz's Bank soal",
      );
      return {
        steps: [
          clickMenu({ role: "combobox", text: "Soal-soal" }),
          clickMenu({ role: "menuitem", text: "Impor" }),
        ],
        continuation: next("import-form"),
      };
    }
    case "import-form": {
      await arrive(io, () => isImportForm(io.doc, io.url()), "Bank soal › Impor");
      const general = collapsedHeaderFor(io.doc, "id_catfromfile");
      return {
        steps: [
          { verb: "check", target: { role: "radio", label: "Format XML Moodle" }, checked: true },
          ...(general ? [clickMenu({ role: "button", text: general })] : []),
          // The questions go into the quiz's own bank, where Tambah › dari bank soal opens.
          {
            verb: "check",
            target: { role: "checkbox", label: "Dapatkan kategori dari berkas" },
            checked: false,
          },
        ],
        continuation: next("drop"),
      };
    }
    case "drop": {
      await arrive(io, () => isImportForm(io.doc, io.url()), "Bank soal › Impor");
      if (pickedFile(io.doc) === plan.fileName) return pointImport(true);
      // The spike: the file handed to Moodle's picker as if she dropped it there.
      io.say(`Nemu menaruh berkas ${plan.fileName} di sini.`);
      io.drop(new File([plan.xml], plan.fileName, { type: "text/xml" }));
      for (let waited = 0; waited < DROP_MS; waited += POLL_MS) {
        if (pickedFile(io.doc) === plan.fileName) return pointImport(true);
        await io.sleep(POLL_MS);
      }
      // Moodle didn't take it: the file goes to Unduhan and she picks it.
      io.download(plan.fileName, plan.xml);
      return {
        steps: [
          {
            verb: "point",
            target: { role: "button", text: "Pilih berkas ..." },
            sentence: `Pilih berkas ${plan.fileName}${teacher}. Nemu sudah menyimpannya di Unduhan.`,
          },
        ],
        continuation: next("picking"),
      };
    }
    case "picking": {
      await arrive(io, () => pickedFile(io.doc) !== null, "The file she picked", PICK_MS);
      return pointImport(false);
    }
    case "imported": {
      await arrive(io, () => importResult(io.doc, io.url()) !== null, "Moodle's import result");
      const result = importResult(io.doc, io.url())!;
      if (result.status === "error") return done({ status: "error", message: result.message });
      return {
        steps: [clickMenu({ role: "link", text: "Soal" })],
        continuation: next("questions"),
      };
    }
    case "questions": {
      await arrive(io, () => onQuizPage(io, continuation.cmid, "/mod/quiz/edit.php"), "Soal");
      return {
        steps: [
          clickMenu({ role: "button", label: "Tambah" }),
          clickMenu({ role: "menuitem", text: "dari bank soal" }),
          { verb: "check", target: { role: "checkbox", label: "Pilih semua" }, checked: true },
          {
            verb: "point",
            target: { role: "button", text: "Tambahkan soal terpilih pada kuis" },
            sentence: `${press("Tambahkan soal terpilih pada kuis")} Nemu sudah memilih ${plan.count} soalnya.`,
          },
        ],
        continuation: next("added"),
      };
    }
    case "added": {
      await arrive(
        io,
        () =>
          onQuizPage(io, continuation.cmid, "/mod/quiz/edit.php") && listedQuestions(io.doc) > 0,
        "Soal with the questions",
      );
      return done({
        status: "added",
        cmid: continuation.cmid ?? quizModule(io.doc, io.url())!.cmid,
        listed: listedQuestions(io.doc),
        dropped: continuation.dropped ?? false,
      });
    }
  }
}
