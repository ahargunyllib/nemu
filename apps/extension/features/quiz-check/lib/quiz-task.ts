import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";
import type { QuizQuestion, QuizSnapshot } from "@nemu/contracts/quiz";

import {
  type ListedQuestion,
  MENU,
  menuLabel,
  previewButton,
  previewPageUrl,
  type QuizPageKind,
  quizPage,
  readAnswerKey,
  readPreviewPages,
  readPreviewQuestions,
  readQuestionsPage,
  readQuizHeader,
  readSettingsPage,
} from "./moodle-pages";

/**
 * F4-01 as one executor task (#209): from the quiz page Nemu opens Setelan, then Soal, then goes
 * back to the quiz and points at Pratinjau kuis, which the teacher presses (it sends a form, so
 * Nemu never does, F0-08). Each page is read when it arrives, so the steps come in parts; what has
 * been read travels in the continuation, which survives the page loads (F0-13). Every step is a
 * menu click or a point, so nothing on the quiz changes.
 */

export const QUIZ_CHECK_KIND = "f4-cek-kuis";

type Phase = "view" | "settings" | "questions" | "preview-start" | "preview";

/** What the earlier pages showed: the quiz page, Setelan and Soal. */
export type QuizFacts = {
  name: string;
  course: string;
  section: string;
  opens: string | null;
  closes: string | null;
  maxGrade: number | null;
  listed: (ListedQuestion & { hasKey: boolean | null })[];
};

export type QuizContinuation = {
  phase: Phase;
  cmid: number;
  /** The teacher's words ("cek kuis ini, harusnya 15 soal"), for the rules that use them. */
  utterance: string;
  /** "Bu" or "Pak" as Nemu knew her when she asked; after a page load it isn't known yet. */
  honorific: string;
  /**
   * After F4-03 put the quiz in (#210): the one sentence Nemu says when the check finds nothing,
   * and the import's own Catatan langkah, which the check's notes follow.
   */
  ready?: string;
  before?: string[];
  facts: QuizFacts;
};

/** What the teacher asked for, carried to the end of the check. */
export type QuizAsked = Pick<QuizContinuation, "utterance" | "honorific" | "ready" | "before">;

/** What the step source needs from the browser; tests pass their own. */
export type QuizIo = {
  doc: Document;
  url(): string;
  /** A page of the same Moodle, read without showing it (a question's edit form, a preview page). */
  fetchPage(url: string): Promise<Document>;
  /** Whether an image shown on this page loaded (`imageLoaded`). */
  imageShown(image: HTMLImageElement): Promise<boolean>;
  /** Whether an image by this address loads (one from a preview page read without showing it). */
  imageLoads(src: string): Promise<boolean>;
  sleep(ms: number): Promise<void>;
};

const EMPTY_FACTS: QuizFacts = {
  name: "",
  course: "",
  section: "",
  opens: null,
  closes: null,
  maxGrade: null,
  listed: [],
};

/** How long a page may take to arrive after a menu click or the teacher's press. */
const ARRIVE_MS = 15_000;
const POLL_MS = 250;

function clickMenu(text: string): ExecutorStep {
  return { verb: "clickMenu", target: { text } };
}

/**
 * The task for the quiz on this page, or null off a Moodle quiz. Started on the quiz page itself,
 * Nemu reads it and opens Setelan; elsewhere in the quiz it opens the quiz page first.
 */
export function quizCheckTask(
  doc: Document,
  url: string,
  asked: QuizAsked,
): { task: ExecutorTask; continuation: QuizContinuation } | null {
  const page = quizPage(doc, url);
  if (!page) return null;
  const task = (steps: ExecutorStep[]): ExecutorTask => ({
    kind: QUIZ_CHECK_KIND,
    title: "Cek kuis",
    source: "Halaman kuis di Moodle",
    steps,
  });
  if (page.kind !== "view")
    return {
      task: task([clickMenu(menuLabel(doc, MENU.quiz))]),
      continuation: { phase: "view", cmid: page.cmid, ...asked, facts: EMPTY_FACTS },
    };
  return {
    task: task([clickMenu(menuLabel(doc, MENU.settings))]),
    continuation: {
      phase: "settings",
      cmid: page.cmid,
      ...asked,
      facts: { ...EMPTY_FACTS, ...readQuizHeader(doc) },
    },
  };
}

/** Waits until the page the last step opens has arrived; the old page may still be showing. */
async function arrive(io: QuizIo, cmid: number, kinds: QuizPageKind[]): Promise<void> {
  for (let waited = 0; ; waited += POLL_MS) {
    const page = quizPage(io.doc, io.url());
    if (page && page.cmid === cmid && kinds.includes(page.kind)) return;
    if (waited >= ARRIVE_MS) throw new Error(`The quiz's ${kinds.join("/")} page didn't open`);
    await io.sleep(POLL_MS);
  }
}

/** Each listed question's key, read from its edit form without opening it on screen. */
async function readKeys(io: QuizIo, cmid: number, listed: ListedQuestion[]) {
  const origin = new URL(io.url()).origin;
  const base = new URL(io.url()).pathname.replace(/\/mod\/quiz\/edit\.php$/u, "");
  return Promise.all(
    listed.map(async (question) => {
      if (question.questionId === null) return { ...question, hasKey: null };
      const form = `${origin}${base}/question/bank/editquestion/question.php?cmid=${cmid}&id=${question.questionId}`;
      const hasKey = await io
        .fetchPage(form)
        .then(readAnswerKey)
        .catch(() => null);
      return { ...question, hasKey };
    }),
  );
}

/**
 * The preview as a student sees it: this page's questions and images as shown, the other pages
 * read by their address. A question the preview numbers but couldn't be read still counts.
 */
export async function readPreview(io: QuizIo, facts: QuizFacts): Promise<QuizSnapshot> {
  const url = io.url();
  const { pages, slots } = readPreviewPages(io.doc, url);
  const current = Number(new URL(url).searchParams.get("page") ?? 0);
  const shown = await Promise.all(
    readPreviewQuestions(io.doc).map(async (question) => ({
      slot: question.slot,
      text: question.text,
      images: await Promise.all(
        question.images.map(async (image) => ({
          alt: image.alt.slice(0, 255),
          loaded: await io.imageShown(image),
        })),
      ),
    })),
  );
  const others = await Promise.all(
    pages
      .filter((page) => page !== current)
      .map(async (page) => {
        const doc = await io.fetchPage(previewPageUrl(url, page)).catch(() => null);
        if (!doc) return [];
        return Promise.all(
          readPreviewQuestions(doc).map(async (question) => ({
            slot: question.slot,
            text: question.text,
            images: await Promise.all(
              question.images.map(async (image) => ({
                alt: image.alt.slice(0, 255),
                loaded: await io.imageLoads(image.src),
              })),
            ),
          })),
        );
      }),
  );
  const read = new Map([...shown, ...others.flat()].map((question) => [question.slot, question]));
  const numbered = slots.length > 0 ? slots : [...read.keys()];
  const byListedSlot = new Map(facts.listed.map((question) => [question.slot, question]));
  const questions: QuizQuestion[] = [...new Set(numbered)]
    .sort((a, b) => a - b)
    .map((slot) => {
      const preview = read.get(slot);
      const listed = byListedSlot.get(slot);
      return {
        slot,
        name: listed?.name ?? "",
        text: preview?.text ?? "",
        hasKey: listed?.hasKey ?? null,
        images: preview?.images ?? [],
      };
    });
  return {
    name: facts.name,
    course: facts.course,
    section: facts.section,
    opens: facts.opens,
    closes: facts.closes,
    maxGrade: facts.maxGrade,
    listed: facts.listed.length,
    questions,
  };
}

/**
 * The step source (F0-09): reads the page the last step opened and gives the next step. On the
 * preview it reads the quiz as students see it and hands it to `onRead`; the task then ends.
 */
export async function nextQuizSteps(
  io: QuizIo,
  continuation: QuizContinuation,
  onRead: (quiz: QuizSnapshot, asked: QuizAsked) => void,
): Promise<{ steps: ExecutorStep[]; continuation: QuizContinuation | null }> {
  const { cmid, facts } = continuation;
  const next = (phase: Phase, read: Partial<QuizFacts>): QuizContinuation => ({
    ...continuation,
    phase,
    facts: { ...facts, ...read },
  });
  switch (continuation.phase) {
    case "view": {
      await arrive(io, cmid, ["view"]);
      return {
        steps: [clickMenu(menuLabel(io.doc, MENU.settings))],
        continuation: next("settings", readQuizHeader(io.doc)),
      };
    }
    case "settings": {
      await arrive(io, cmid, ["settings"]);
      return {
        steps: [clickMenu(menuLabel(io.doc, MENU.questions))],
        continuation: next("questions", readSettingsPage(io.doc)),
      };
    }
    case "questions": {
      await arrive(io, cmid, ["questions"]);
      const { questions, maxGrade } = readQuestionsPage(io.doc);
      const listed = await readKeys(io, cmid, questions);
      return {
        steps: [clickMenu(menuLabel(io.doc, MENU.quiz))],
        continuation: next("preview-start", { maxGrade, listed }),
      };
    }
    case "preview-start": {
      await arrive(io, cmid, ["view"]);
      const button = previewButton(io.doc) ?? "Pratinjau kuis";
      const teacher = continuation.honorific ? `, ${continuation.honorific}` : "";
      return {
        steps: [
          {
            verb: "point",
            target: { role: "button", text: button },
            sentence: `Tekan ${button}${teacher}. Nemu melihat kuis ini seperti siswa melihatnya.`,
          },
        ],
        continuation: next("preview", {}),
      };
    }
    case "preview": {
      await arrive(io, cmid, ["attempt"]);
      const { utterance, honorific, ready, before } = continuation;
      onRead(await readPreview(io, facts), { utterance, honorific, ready, before });
      return { steps: [], continuation: null };
    }
  }
}
