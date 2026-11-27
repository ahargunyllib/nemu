import { normalizeControlName } from "@nemu/ai/school/safety";
import type { NemuChoice, NemuDisplay } from "@nemu/ui/lib/nemu-display";

import { executor } from "../../executor/stores/executor";
import {
  COUNT_KIND,
  type CountContinuation,
  countLine,
  countTask,
  nextCountSteps,
  nextShowSteps,
  type QuizRef,
  SHOW_DELETE_KIND,
  type ShowContinuation,
  showDeleteTask,
  type DeleteIo,
} from "../lib/delete-task";
import {
  attemptCountElement,
  isCoursePage,
  quizHere,
  readCourseQuizzes,
} from "../lib/moodle-course";
import { type CourseQuiz, localDay, pickQuiz } from "../lib/pick-quiz";
import { KEEP, NOTHING_DELETED, SHOW, warning, warningCard } from "../lib/warning";

/**
 * F4-06 (#211): "Tolong hapus latihan bahasa Inggris yang kemarin." Nemu works out which quiz
 * she means (and asks when a similar one is close), opens its Hasil page through the menus and
 * reads how many students took it, then warns on a Kartu Pilih with "Jangan hapus" first. Nemu
 * never presses Hapus: "Tunjukkan tombol Hapus" only takes her to it and points.
 */

export type QuizDeleteView = { display: NemuDisplay | null; target: Element | null };

type Context = { honorific: string; speak: (text: string) => void };

/** What the Kartu Pilih on screen is waiting for. */
type Waiting =
  | { kind: "which"; candidates: CourseQuiz[] }
  | { kind: "warn"; quiz: QuizRef; count: number; notes: string[] };

function say(sentence: string, honorific: string): string {
  return honorific ? `${sentence}, ${honorific}.` : `${sentence}.`;
}

function createQuizDelete() {
  const listeners = new Set<() => void>();
  let context: Context = { honorific: "", speak: () => {} };
  let view: QuizDeleteView = { display: null, target: null };
  let waiting: Waiting | null = null;
  /** The count from the step source, for the finisher on the same page. */
  let counted: { quiz: QuizRef; count: number } | null = null;

  function publish(next: QuizDeleteView) {
    view = next;
    for (const listener of listeners) listener();
  }

  function close() {
    waiting = null;
    publish({ display: null, target: null });
  }

  function notice(sentence: string) {
    waiting = null;
    publish({ display: { type: "jawab", sentence, onClose: close }, target: null });
    context.speak(sentence);
  }

  const io = (): DeleteIo => ({
    doc: document,
    url: () => location.href,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  /** The first task: open the quiz and its Hasil page, and read the count. */
  async function count(quiz: QuizRef) {
    close();
    const started = countTask(document, location.href, quiz);
    await executor.start(started.task, { cara: 1, continuation: started.continuation });
  }

  /** "Kuis yang mana?" between quizzes that score close (the F4-3 decoy). */
  function askWhich(candidates: CourseQuiz[]) {
    waiting = { kind: "which", candidates };
    const choices: NemuChoice[] = candidates.map((quiz) => ({
      id: String(quiz.cmid),
      label: quiz.name,
    }));
    if (choices.length === 2) choices.push({ id: "bukan", label: "Bukan keduanya" });
    const question = say("Kuis yang mana yang mau dihapus", context.honorific).replace(/\.$/u, "?");
    publish({
      display: {
        type: "pilih",
        question,
        choices: choices as [NemuChoice, NemuChoice] | [NemuChoice, NemuChoice, NemuChoice],
        onChoose: chooseQuiz,
      },
      target: null,
    });
    context.speak(question);
  }

  function chooseQuiz(id: string) {
    if (waiting?.kind !== "which") return;
    const quiz = waiting.candidates.find((candidate) => String(candidate.cmid) === id);
    if (quiz) return void count({ cmid: quiz.cmid, name: quiz.name });
    notice(say("Baik. Sebutkan nama kuisnya, Nemu cari lagi", context.honorific));
  }

  /** Kartu Pilih with ⚠ under the safe choice, pointing at the count on the Hasil page. */
  function warn(quiz: QuizRef, students: number, notes: string[]) {
    waiting = { kind: "warn", quiz, count: students, notes };
    const card = warningCard(students, chooseAction);
    publish({ display: { type: "pilih", ...card }, target: attemptCountElement(document) });
    context.speak(card.question);
  }

  function chooseAction(id: "jangan" | "tunjukkan") {
    if (waiting?.kind !== "warn") return;
    const { quiz, count: students, notes } = waiting;
    close();
    if (id === "jangan") {
      executor.presentNotes([
        ...notes,
        countLine(quiz.name, students),
        `Pilihan: ${KEEP}. Kuis dan nilainya tetap ada.`,
        NOTHING_DELETED,
      ]);
      return;
    }
    // Nemu goes to Hapus with the cursor and points; the press, if any, is hers.
    const started = showDeleteTask(document, quiz, students, context.honorific);
    void executor.start(started.task, { cara: 1, continuation: started.continuation });
  }

  executor.registerStepSource(COUNT_KIND, (continuation) =>
    nextCountSteps(io(), continuation as CountContinuation, (quiz, students) => {
      counted = { quiz, count: students };
    }),
  );
  executor.registerFinisher(COUNT_KIND, (ended, notes, showNotes) => {
    const found = counted;
    counted = null;
    if (ended.status !== "done" || !found) return executor.presentNotes(notes, null, showNotes);
    warn(found.quiz, found.count, notes);
  });
  executor.registerStepSource(SHOW_DELETE_KIND, (continuation) =>
    nextShowSteps(io(), continuation as ShowContinuation, () => context.honorific),
  );
  executor.registerFinisher(SHOW_DELETE_KIND, (ended, notes, showNotes) => {
    const source = ended.task.source ? [ended.task.source] : [];
    executor.presentNotes(
      [...source, `Pilihan: ${SHOW}.`, ...notes, NOTHING_DELETED],
      null,
      showNotes,
    );
  });

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,

    connect(next: Context) {
      context = next;
    },

    /** "Tolong hapus latihan bahasa Inggris yang kemarin." on the course page or a quiz page. */
    async start(utterance: string) {
      const here = quizHere(document, location.href);
      if (here) return count(here);
      if (!isCoursePage(document, location.href))
        return notice(
          say("Buka dulu halaman kursusnya di Moodle, lalu minta Nemu lagi", context.honorific),
        );
      const pick = pickQuiz(readCourseQuizzes(document), utterance, localDay(new Date()));
      if (pick.kind === "one") return count({ cmid: pick.quiz.cmid, name: pick.quiz.name });
      if (pick.kind === "ask") return askWhich(pick.candidates);
      notice(say("Nemu belum menemukan kuis itu di kursus ini", context.honorific));
    },

    /** Her spoken answer to the Kartu Pilih on screen; false when nothing is waiting. */
    hear(text: string): boolean {
      if (!waiting) return false;
      const said = ` ${normalizeControlName(text)} `;
      if (waiting.kind === "warn") {
        if (said.includes(" jangan ") || said.includes(" batal ")) chooseAction("jangan");
        else if (said.includes(" tunjuk") || said.includes(" hapus ")) chooseAction("tunjukkan");
        else context.speak(warning(waiting.count));
        return true;
      }
      const pick = pickQuiz(waiting.candidates, text, localDay(new Date()));
      if (pick.kind === "one") chooseQuiz(String(pick.quiz.cmid));
      else if (said.includes(" bukan ")) chooseQuiz("bukan");
      return true;
    },

    close,
  };
}

/** The page's one quiz-deletion warning (#211). */
export const quizDelete = createQuizDelete();
