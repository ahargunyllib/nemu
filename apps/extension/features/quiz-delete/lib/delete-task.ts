import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";

import { menuLabel, quizPage } from "../../quiz-check/lib/moodle-pages";
import {
  courseLinkText,
  deleteControls,
  editModeLabel,
  isCoursePage,
  isEditing,
  isResultsPage,
  readAttemptCount,
  RESULTS_MENU,
} from "./moodle-course";

/**
 * F4-06 as two executor tasks (#211). The first opens the quiz and its Hasil page through the
 * menus and reads how many students took it; Nemu then asks, with "Jangan hapus" first. Only when
 * the teacher chooses "Tunjukkan tombol Hapus" does the second run: back to the course, Mode Edit,
 * the quiz's Edit menu, and a point at Hapus, which she presses herself or not at all. Nemu never
 * presses Hapus: it is only ever pointed at, and the executor refuses it anyway (F0-08).
 */

export const COUNT_KIND = "f4-hapus-kuis";
export const SHOW_DELETE_KIND = "f4-tunjuk-hapus";

export type QuizRef = { cmid: number; name: string };

export type CountContinuation = QuizRef & { phase: "view" | "results" };
export type ShowContinuation = QuizRef & {
  phase: "course" | "editing";
  count: number;
  /** "Bu" or "Pak" as Nemu knew her when she chose; after a page load it isn't known yet. */
  honorific: string;
};

/** What the step sources need from the browser; tests pass their own. */
export type DeleteIo = {
  doc: Document;
  url(): string;
  sleep(ms: number): Promise<void>;
};

/** How long a page may take to arrive after a menu click. */
const ARRIVE_MS = 15_000;
const POLL_MS = 250;

async function arrive(io: DeleteIo, what: string, ready: () => boolean): Promise<void> {
  for (let waited = 0; ; waited += POLL_MS) {
    if (ready()) return;
    if (waited >= ARRIVE_MS) throw new Error(`The ${what} didn't open`);
    await io.sleep(POLL_MS);
  }
}

function clickMenu(target: ExecutorStep["target"]): ExecutorStep {
  return { verb: "clickMenu", target };
}

/** "Halaman Hasil: 3 siswa sudah mengerjakan Latihan: My Family (has/have)" */
export function countLine(name: string, count: number): string {
  return count > 0
    ? `Halaman Hasil: ${count} siswa sudah mengerjakan ${name}`
    : `Halaman Hasil: belum ada siswa yang mengerjakan ${name}`;
}

/**
 * The counting task for a quiz. From the course page Nemu opens the quiz by its name; on the
 * quiz's own pages it opens Hasil, or reads it at once when Hasil is already showing.
 */
export function countTask(
  doc: Document,
  url: string,
  quiz: QuizRef,
): { task: ExecutorTask; continuation: CountContinuation } {
  const task = (steps: ExecutorStep[]): ExecutorTask => ({
    kind: COUNT_KIND,
    title: "Cek siswa sebelum hapus kuis",
    source: "Halaman Hasil kuis di Moodle",
    steps,
  });
  if (isResultsPage(doc, url, quiz.cmid))
    return { task: task([]), continuation: { ...quiz, phase: "results" } };
  if (quizPage(doc, url)?.cmid === quiz.cmid)
    return {
      task: task([clickMenu({ text: menuLabel(doc, RESULTS_MENU) })]),
      continuation: { ...quiz, phase: "results" },
    };
  return {
    task: task([clickMenu({ role: "link", text: quiz.name })]),
    continuation: { ...quiz, phase: "view" },
  };
}

/** Step source of the counting task: the quiz page, then Hasil, where the count is read. */
export async function nextCountSteps(
  io: DeleteIo,
  continuation: CountContinuation,
  onCount: (quiz: QuizRef, count: number) => void,
): Promise<{ steps: ExecutorStep[]; continuation: CountContinuation | null }> {
  const { cmid, name } = continuation;
  if (continuation.phase === "view") {
    await arrive(io, "quiz page", () => {
      const page = quizPage(io.doc, io.url());
      return page?.cmid === cmid && page.kind === "view";
    });
    return {
      steps: [clickMenu({ text: menuLabel(io.doc, RESULTS_MENU) })],
      continuation: { ...continuation, phase: "results" },
    };
  }
  await arrive(io, "quiz's Hasil page", () => isResultsPage(io.doc, io.url(), cmid));
  onCount({ cmid, name }, readAttemptCount(io.doc));
  return { steps: [], continuation: null };
}

/** The task behind "Tunjukkan tombol Hapus", started on the quiz's Hasil page. */
export function showDeleteTask(
  doc: Document,
  quiz: QuizRef,
  count: number,
  honorific: string,
): { task: ExecutorTask; continuation: ShowContinuation } {
  const course = courseLinkText(doc);
  return {
    task: {
      kind: SHOW_DELETE_KIND,
      title: "Tunjukkan tombol Hapus",
      // Where the warning came from, for Catatan langkah after the page loads.
      source: countLine(quiz.name, count),
      steps: course ? [clickMenu({ role: "link", text: course })] : [],
    },
    continuation: { ...quiz, count, honorific, phase: "course" },
  };
}

/**
 * Step source of the second task: on the course page Nemu switches on Mode Edit if it is off,
 * opens the quiz's Edit menu and points at Hapus. That point is the last step.
 */
export async function nextShowSteps(
  io: DeleteIo,
  continuation: ShowContinuation,
  honorific: () => string,
): Promise<{ steps: ExecutorStep[]; continuation: ShowContinuation | null }> {
  const { cmid, name } = continuation;
  const listed = () => isCoursePage(io.doc, io.url()) && !!io.doc.getElementById(`module-${cmid}`);
  if (continuation.phase === "course") {
    await arrive(io, "course page", listed);
    if (!isEditing(io.doc)) {
      const label = editModeLabel(io.doc);
      return {
        steps: [{ verb: "check", target: { role: "checkbox", label }, checked: true }],
        continuation: { ...continuation, phase: "editing" },
      };
    }
  }
  // Mode Edit reloads the page; the old one may still show for a moment.
  await arrive(io, "course page in Mode Edit", () => listed() && isEditing(io.doc));
  await arrive(io, "quiz's Edit menu", () => deleteControls(io.doc, cmid) !== null);
  const { menu, remove } = deleteControls(io.doc, cmid)!;
  const teacher = honorific() || continuation.honorific;
  return {
    steps: [
      clickMenu({ role: "button", label: menu, near: name }),
      {
        verb: "point",
        target: { role: "menuitem", text: remove, near: name },
        sentence: `Tombol ${remove} ada di sini${teacher ? `, ${teacher}` : ""}. Nemu tidak menghapus apa pun.`,
      },
    ],
    continuation: null,
  };
}
