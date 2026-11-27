import type { QuizProblem, QuizSnapshot } from "@nemu/contracts/quiz";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

import type { PageEmail } from "../../../shared/lib/messages";
import type { RunState } from "../../executor/lib/run";
import { executor } from "../../executor/stores/executor";
import { requestQuizCheck } from "../api/request-quiz-check";
import { imageLoaded, quizHeading, questionTarget } from "../lib/moodle-pages";
import { checkQuiz, closingSentence } from "../lib/quiz-rules";
import {
  nextQuizSteps,
  type QuizAsked,
  QUIZ_CHECK_KIND,
  type QuizContinuation,
  quizCheckTask,
  type QuizIo,
} from "../lib/quiz-task";

/**
 * F4-01 (#209): "Nemu, tolong cek kuis ini." The executor opens the quiz's pages one by one and
 * reads them (`quiz-task`); once the preview is read, the DOM rules and the Nemu Service's
 * judgement checks (#218) give the problems, and Nemu points at each one on the preview with one
 * sentence. Nothing on the quiz changes: Nemu only clicks menus and points.
 */

export type QuizCheckView = { display: NemuDisplay | null; target: Element | null };

/**
 * The problems being pointed at, kept in the background so a page load carries on (F0-13).
 * `changed` is true after F4-03 put the quiz in: then the notes don't say nothing changed.
 * `closing` is the sentence after the last problem (#256), shown when `index` passes it.
 */
type Pointing = {
  problems: QuizProblem[];
  index: number;
  notes: string[];
  changed?: boolean;
  closing?: string | null;
};

type Context = { pageEmail: PageEmail; honorific: string; speak: (text: string) => void };

const NOTHING_CHANGED = "Nemu tidak mengubah apa pun di kuis ini.";

function say(sentence: string, honorific: string): string {
  return honorific ? `${sentence}, ${honorific}.` : `${sentence}.`;
}

async function fetchPage(url: string): Promise<Document> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return new DOMParser().parseFromString(await response.text(), "text/html");
}

function imageLoads(src: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    image.addEventListener("load", () => {
      clearTimeout(timer);
      resolve(image.naturalWidth > 0);
    });
    image.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    image.src = src;
  });
}

function createQuizCheck() {
  const listeners = new Set<() => void>();
  let context: Context = { pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} };
  let view: QuizCheckView = { display: null, target: null };
  let pointing: Pointing | null = null;
  /** The quiz as the preview showed it, from the step source to the finisher on the same page. */
  let read: ({ quiz: QuizSnapshot } & QuizAsked) | null = null;

  function publish(next: QuizCheckView) {
    view = next;
    for (const listener of listeners) listener();
  }

  function save() {
    void requestQuizCheck(context.pageEmail, { op: "state-save", state: pointing });
  }

  const io = (): QuizIo => ({
    doc: document,
    url: () => location.href,
    fetchPage,
    imageShown: (image) => imageLoaded(image),
    imageLoads,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  function targetFor(problem: QuizProblem): Element | null {
    if (problem.slot === null) return quizHeading(document);
    const kind =
      problem.kind === "missing_image" || problem.kind === "no_key" ? problem.kind : "other";
    return questionTarget(document, problem.slot, kind);
  }

  /**
   * One problem at a time, pointed at on the page, with the next one behind Berikutnya. After the
   * last one Nemu says the closing sentence (#256), about no element, and Catatan langkah follows.
   */
  function show() {
    if (!pointing) return publish({ display: null, target: null });
    const { problems, index, closing } = pointing;
    const problem = problems[index];
    if (!problem) return closing && index === problems.length ? showReady(closing) : finish();
    const last = index === problems.length - 1 && !closing;
    publish({
      display: {
        type: "jawab",
        sentence: problem.sentence,
        status: {
          tone: "unsaved",
          text: "Masalah di kuis",
          progress: { done: index + 1, total: problems.length },
        },
        action: { label: last ? "Selesai" : "Berikutnya", onSelect: last ? finish : next },
        onClose: close,
      },
      target: targetFor(problem),
    });
    context.speak(problem.sentence);
  }

  /** The quiz is ready: with no problems, or apart from those just shown. Catatan langkah follows. */
  function showReady(sentence: string) {
    publish({
      display: {
        type: "jawab",
        sentence,
        action: { label: "Catatan langkah", onSelect: finish },
        onClose: close,
      },
      target: null,
    });
    context.speak(sentence);
  }

  function next() {
    if (!pointing) return;
    pointing = { ...pointing, index: pointing.index + 1 };
    save();
    show();
  }

  function lines(state: Pointing): string[] {
    const found =
      state.problems.length === 0
        ? ["Nemu tidak menemukan masalah."]
        : state.problems.map((problem) => `Masalah: ${problem.sentence}`);
    return [...state.notes, ...found, ...(state.changed ? [] : [NOTHING_CHANGED])];
  }

  /** Catatan langkah: the steps, every problem, and that nothing was changed. */
  function finish() {
    const state = pointing;
    pointing = null;
    save();
    publish({ display: null, target: null });
    if (state) executor.presentNotes(lines(state));
  }

  /** ×: the problems are kept in Catatan langkah, which the Nemu button reopens. */
  function close() {
    const state = pointing;
    pointing = null;
    save();
    publish({ display: null, target: null });
    if (state) executor.presentNotes(lines(state), null, false);
  }

  async function afterRun(ended: RunState, notes: string[], showNotes: boolean) {
    const found = read;
    read = null;
    // After F4-03 (#210) the import's own notes come first, whether or not the check finished.
    const before = found?.before ?? (ended.continuation as QuizContinuation | null)?.before;
    if (before) notes = [...before, ...notes];
    if (ended.status !== "done" || !found) return executor.presentNotes(notes, null, showNotes);
    const changed = !!before;
    publish({
      display: {
        type: "kerja",
        sentence: "Nemu memeriksa soal-soalnya…",
        status: { tone: "working", text: "Nemu mengecek kuis" },
        onSlow: () => undefined,
        onStop: () => publish({ display: null, target: null }),
      },
      target: null,
    });
    // She is addressed as Nemu knew her when she asked: the identity may still be loading here.
    const honorific = context.honorific || found.honorific;
    const problems = checkQuiz(found.quiz, {
      now: new Date(),
      honorific,
      utterance: found.utterance,
    });
    // #218: judgement checks from the Nemu Service; without them the rules still stand.
    const judged = await requestQuizCheck(context.pageEmail, {
      op: "judge",
      input: { quiz: found.quiz, utterance: found.utterance, found: problems },
    });
    const all = [...problems, ...(judged.ok ? judged.value.problems : [])];
    if (all.length === 0) {
      pointing = { problems: [], index: 0, notes, changed };
      showReady(found.ready ?? say("Kuis ini sudah siap. Nemu tidak menemukan masalah", honorific));
      return;
    }
    pointing = {
      problems: all,
      index: 0,
      notes,
      changed,
      closing: closingSentence(all.length, honorific),
    };
    save();
    show();
  }

  executor.registerStepSource(QUIZ_CHECK_KIND, (continuation) =>
    nextQuizSteps(io(), continuation as QuizContinuation, (quiz, asked) => {
      read = { quiz, ...asked };
    }),
  );
  executor.registerFinisher(QUIZ_CHECK_KIND, (ended, notes, showNotes) => {
    void afterRun(ended, notes, showNotes);
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

    /**
     * "Nemu, tolong cek kuis ini." on any page of a Moodle quiz. F4-03 (#210) also starts it
     * once the teacher has added the questions, with its own sentence and notes (`QuizAsked`).
     */
    async start(utterance: string, after: Pick<QuizAsked, "ready" | "before"> = {}) {
      pointing = null;
      save();
      const started = quizCheckTask(document, location.href, {
        utterance,
        honorific: context.honorific,
        ...after,
      });
      if (!started) {
        const sentence = say(
          "Buka dulu halaman kuisnya di Moodle, lalu minta Nemu mengecek lagi",
          context.honorific,
        );
        publish({ display: { type: "jawab", sentence, onClose: close }, target: null });
        context.speak(sentence);
        return;
      }
      publish({ display: null, target: null });
      // Nemu opens the pages itself (cara 1); its only steps are menu clicks and one point.
      await executor.start(started.task, { cara: 1, continuation: started.continuation });
    },

    /** After a page load: point at the problem Nemu was on, now on this page if it is here. */
    async restore() {
      const saved = await requestQuizCheck(context.pageEmail, { op: "state-load" });
      if (!saved.ok || !saved.value) return;
      pointing = saved.value as Pointing;
      // A missing image is told apart only once the browser gives up on it; until then Nemu
      // would point at the whole question.
      const images = document.querySelectorAll<HTMLImageElement>(".que .formulation img");
      await Promise.all([...images].map((image) => imageLoaded(image)));
      show();
    },

    close,
  };
}

/** The page's one quiz check (#209). */
export const quizCheck = createQuizCheck();
