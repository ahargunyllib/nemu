import { applyQuizAnswers, moodleXml, quizFileName } from "@nemu/ai/school/quiz/moodle-xml";
import { quizTimesFrom } from "@nemu/ai/school/quiz/times";
import type {
  QuizDraft,
  QuizScriptAnswer,
  QuizScriptQuestion,
  QuizTime,
} from "@nemu/contracts/quiz";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

import type { PageEmail } from "../../../shared/lib/messages";
import { executor } from "../../executor/stores/executor";
import { quizCheck } from "../../quiz-check/stores/quiz-check";
import { requestQuizImport } from "../api/request-quiz-import";
import { answerFrom, choicesFor } from "../lib/answers";
import {
  type ImportContinuation,
  type ImportOutcome,
  importStages,
  nextImportSteps,
  QUIZ_IMPORT_KIND,
  quizImportTask,
} from "../lib/import-task";
import { type CoursePage, coursePage, dropFile } from "../lib/moodle-course";
import {
  type ImportPlan,
  readySentence,
  timesInOrder,
  timesSentence,
  withDefaults,
} from "../lib/plan";
import { dataUrlBytes, fileKind, fileMeta, pdfPageCount } from "../lib/script-file";

/**
 * F4-03 (#210): "Nemu, masukkan kuis dari naskah ini, buka Senin 7 Desember, tutup Kamis 10
 * Desember." on the course page. She picks the script; the Nemu Service reads it (#219); Nemu asks
 * about every part it couldn't read (Kartu Pilih, as F1 does) and about a date she didn't say,
 * then asks "Pasang kuis dari naskah ini?" on a start card with the script, the times it will set
 * and the stages it will take (F4·06), and on Mulai puts the quiz into Moodle in cara 1
 * (`import-task`). After
 * she adds the questions, the F4-1 check (#209) runs on the new quiz and Nemu reports in one
 * sentence.
 */

export type QuizImportView = { display: NemuDisplay | null; typing: boolean };

type Context = { pageEmail: PageEmail; honorific: string; speak: (text: string) => void };

type Phase =
  | { name: "idle" }
  | { name: "pick"; message?: string }
  | { name: "reading" }
  | { name: "asking"; index: number; message?: string }
  | { name: "times"; message?: string }
  | { name: "ready"; summary?: boolean };

const ACCEPT = ".pdf,.doc,.docx,image/*,application/pdf";

function say(sentence: string, honorific: string): string {
  return honorific ? `${sentence}, ${honorific}.` : `${sentence}.`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

/** The fallback when Moodle doesn't take the drop: the XML lands in her Unduhan. */
function download(fileName: string, xml: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: "text/xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function createQuizImport() {
  const listeners = new Set<() => void>();
  let context: Context = { pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} };
  let view: QuizImportView = { display: null, typing: false };
  let phase: Phase = { name: "idle" };
  let utterance = "";
  let course: CoursePage | null = null;
  let draft: QuizDraft | null = null;
  let questions: QuizScriptQuestion[] = [];
  let answers: QuizScriptAnswer[] = [];
  let skipped: number[] = [];
  let opens: QuizTime | null = null;
  let closes: QuizTime | null = null;
  /** The script she picked, for the start card's chip. */
  let script: { name: string; kind: string; pages: number | null } | null = null;
  /** How the import ended on this page, for the finisher. */
  let finished: { outcome: ImportOutcome; plan: ImportPlan; honorific: string } | null = null;

  function publish(next: QuizImportView) {
    view = next;
    for (const listener of listeners) listener();
  }

  function honorific() {
    return context.honorific;
  }

  function show(display: NemuDisplay | null, typing = false, spoken?: string) {
    publish({ display, typing });
    if (spoken) context.speak(spoken);
  }

  function close() {
    phase = { name: "idle" };
    draft = null;
    script = null;
    questions = [];
    answers = [];
    show(null);
  }

  function setPhase(next: Phase) {
    phase = next;
    render();
  }

  function render() {
    switch (phase.name) {
      case "idle":
        return show(null);
      case "pick": {
        const sentence =
          phase.message ?? say("Pilih naskah soalnya: PDF, Word, atau foto", honorific());
        return show(
          {
            type: "jawab",
            sentence,
            action: { label: "Pilih naskah", onSelect: pickFile },
            onClose: close,
          },
          false,
          sentence,
        );
      }
      case "reading":
        return show({
          type: "kerja",
          sentence: "Nemu membaca naskahnya…",
          status: { tone: "working", text: "Membaca naskah" },
          onSlow: () => undefined,
          onStop: close,
        });
      case "asking": {
        const question = questions[phase.index]!;
        const prompt = phase.message ? `${phase.message} ${question.prompt}` : question.prompt;
        const choices = choicesFor(question);
        const note = `Pertanyaan ${phase.index + 1} dari ${questions.length} · Nemu tidak mengisi soal sendiri.`;
        if (choices)
          return show(
            {
              type: "pilih",
              question: prompt,
              choices,
              note,
              onChoose: (id) => answer(question.options[Number(id)]!),
            },
            question.kind === "text" || question.kind === "key",
            prompt,
          );
        return show({ type: "jawab", sentence: prompt, onClose: close }, true, prompt);
      }
      case "times": {
        const missing =
          !opens && !closes
            ? "Kuisnya dibuka dan ditutup tanggal berapa"
            : !opens
              ? "Kuisnya dibuka tanggal berapa"
              : "Kuisnya ditutup tanggal berapa";
        const sentence = phase.message ?? say(missing, honorific());
        return show({ type: "jawab", sentence, onClose: close }, true, sentence);
      }
      case "ready": {
        if (!draft || !opens || !closes) return close();
        const count = draft.questions.length;
        const heading = { text: "Naskah masuk", count: `${count} soal` };
        const section = draft.section ?? course?.sections[0] ?? "";
        // Lihat ringkasan: the questions Nemu read, until Tutup brings the start card back.
        if (phase.summary)
          return show({
            type: "info",
            status: heading,
            title: `${draft.name} · bagian ${section}`,
            ...(skipped.length ? { detail: `Dilewati: soal ${skipped.join(", ")}` } : {}),
            items: draft.questions.map((question) => question.text || "(gambar)"),
            onClose: () => setPhase({ name: "ready" }),
          });
        const times = withDefaults(opens, closes);
        const question = "Pasang kuis dari naskah ini?";
        return show(
          {
            type: "pilih",
            layout: "row",
            status: heading,
            question,
            // The times aren't spoken any more, but she still reads which ones Nemu chose.
            detail: timesSentence(times.opens, times.closes, times.defaulted, ""),
            ...(script
              ? {
                  file: {
                    name: script.name,
                    kind: script.kind,
                    meta: fileMeta(count, script.pages),
                  },
                }
              : {}),
            steps: importStages(section, honorific()),
            link: {
              label: "Lihat ringkasan",
              onSelect: () => setPhase({ name: "ready", summary: true }),
            },
            choices: [
              { id: "nanti", label: "Nanti" },
              { id: "mulai", label: "Mulai" },
            ],
            onChoose: (id) => (id === "mulai" ? void begin() : close()),
          },
          false,
          question,
        );
      }
    }
  }

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (file) void read(file);
    });
    document.body.append(input);
    input.click();
  }

  async function read(file: File) {
    if (!course) return close();
    setPhase({ name: "reading" });
    const dataUrl = await readFile(file).catch(() => "");
    if (!dataUrl)
      return setPhase({
        name: "pick",
        message: say("Berkasnya tidak bisa dibuka. Pilih lagi", honorific()),
      });
    const kind = fileKind(file.name, file.type);
    script = {
      name: file.name,
      kind,
      pages: kind === "PDF" ? pdfPageCount(dataUrlBytes(dataUrl)) : null,
    };
    const response = await requestQuizImport(context.pageEmail, {
      op: "read",
      input: {
        file: { name: file.name, mimeType: file.type || "application/octet-stream", dataUrl },
        utterance,
        today: today(),
        course: course.course,
        sections: course.sections,
      },
    });
    if (phase.name !== "reading") return;
    if (!response.ok) return setPhase({ name: "pick", message: response.message });
    const result = response.value;
    if (result.status === "unreadable") return setPhase({ name: "pick", message: result.message });
    draft = result.draft;
    questions = result.questions;
    answers = [];
    opens = draft.opens;
    closes = draft.closes;
    afterAnswers();
  }

  function answer(value: string) {
    if (phase.name !== "asking") return;
    const question = questions[phase.index]!;
    answers = [
      ...answers.filter((given) => given.questionId !== question.id),
      { questionId: question.id, answer: value },
    ];
    afterAnswers();
  }

  /** The next question she hasn't answered, then the times, then the plan. */
  function afterAnswers() {
    const open = questions.findIndex(
      (question) => !answers.some((given) => given.questionId === question.id),
    );
    if (open >= 0) return setPhase({ name: "asking", index: open });
    if (!draft) return close();
    const applied = applyQuizAnswers(draft, questions, answers);
    draft = applied.draft;
    skipped = applied.skipped;
    questions = [];
    answers = [];
    if (draft.questions.length === 0) {
      const sentence = say("Semua soal dilewati, jadi tidak ada yang dimasukkan", honorific());
      phase = { name: "idle" };
      return show({ type: "jawab", sentence, onClose: close }, false, sentence);
    }
    askTimesOrReady();
  }

  function askTimesOrReady(message?: string) {
    if (!opens || !closes) return setPhase({ name: "times", message });
    const times = withDefaults(opens, closes);
    if (!timesInOrder(times.opens, times.closes)) {
      opens = null;
      closes = null;
      return setPhase({
        name: "times",
        message: say(
          "Waktu tutupnya sebelum waktu buka. Kuisnya dibuka dan ditutup tanggal berapa",
          honorific(),
        ),
      });
    }
    setPhase({ name: "ready" });
  }

  async function begin() {
    const page = coursePage(document, location.href);
    if (!draft || !opens || !closes || !page) return close();
    const times = withDefaults(opens, closes);
    const plan: ImportPlan = {
      courseId: page.courseId,
      section: draft.section ?? page.sections[0] ?? "",
      name: draft.name,
      opens: times.opens,
      closes: times.closes,
      xml: moodleXml(draft),
      fileName: quizFileName(draft),
      count: draft.questions.length,
    };
    const started = quizImportTask(document, location.href, plan, context.honorific);
    close();
    if (!started) return;
    // Cara 1: Nemu opens every menu and fills every field; each form submit is hers (F0-08).
    await executor.start(started.task, { cara: 1, continuation: started.continuation });
  }

  /** The import ended: the F4-1 check on the new quiz, then one sentence (#210). */
  function afterRun(status: string, notes: string[], showNotes: boolean) {
    const done = finished;
    finished = null;
    if (status !== "done" || !done) return executor.presentNotes(notes, null, showNotes);
    const { outcome, plan } = done;
    const teacher = done.honorific || context.honorific;
    if (outcome.status === "error") {
      const sentence = say(
        `Moodle menolak berkasnya: ${outcome.message.replace(/[.\s]+$/u, "")}`,
        teacher,
      );
      executor.presentNotes([...notes, `Moodle: ${outcome.message}`], null, false);
      return show({ type: "jawab", sentence, onClose: close }, false, sentence);
    }
    const dropped = outcome.dropped
      ? `Nemu menaruh berkas ${plan.fileName} di Impor (seret dan lepas)`
      : `Nemu menyimpan ${plan.fileName} di Unduhan; ${teacher || "Anda"} memilihnya di Impor`;
    // The drop goes right before her press on Impor, where it happened.
    const impor = notes.findIndex((line) => line.endsWith("menekan Impor"));
    const before = impor < 0 ? [...notes, dropped] : notes.toSpliced(impor, 0, dropped);
    void quizCheck.start(`cek kuis ini, ${plan.count} soal`, {
      ready: readySentence(plan, outcome.listed, teacher),
      before,
    });
  }

  executor.registerStepSource(QUIZ_IMPORT_KIND, (continuation) => {
    const current = continuation as ImportContinuation;
    return nextImportSteps(
      {
        doc: document,
        url: () => location.href,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        drop: (file) => dropFile(document, file),
        download,
        say: (sentence) => context.speak(sentence),
      },
      current,
      (outcome) => {
        finished = { outcome, plan: current.plan, honorific: current.honorific };
      },
    );
  });
  executor.registerFinisher(QUIZ_IMPORT_KIND, (ended, notes, showNotes) => {
    // The check starts its own run; this one has just ended.
    setTimeout(() => afterRun(ended.status, notes, showNotes), 0);
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

    /** "Nemu, masukkan kuis dari naskah ini …" on a Moodle course page. */
    start(words: string) {
      close();
      utterance = words;
      course = coursePage(document, location.href);
      if (!course) {
        const sentence = say(
          "Buka dulu halaman kursusnya di Moodle, lalu minta Nemu memasukkan kuisnya lagi",
          honorific(),
        );
        return show({ type: "jawab", sentence, onClose: close }, false, sentence);
      }
      setPhase({ name: "pick" });
    },

    /** Typed or spoken words while Nemu waits for an answer; false when it isn't waiting. */
    hear(words: string): boolean {
      if (phase.name === "asking") {
        const question = questions[phase.index]!;
        const value = answerFrom(question, words);
        if (value) answer(value);
        else
          setPhase({
            name: "asking",
            index: phase.index,
            message: say("Nemu belum menangkap jawabannya", honorific()),
          });
        return true;
      }
      if (phase.name === "times") {
        const heard = quizTimesFrom(words, today());
        // "10 Desember" alone answers the one date still missing.
        if (heard.opens && !heard.closes && opens && !closes) {
          closes = heard.opens;
        } else {
          opens = heard.opens ?? opens;
          closes = heard.closes ?? closes;
        }
        askTimesOrReady(
          heard.opens || heard.closes
            ? undefined
            : say("Nemu belum menangkap tanggalnya", honorific()),
        );
        return true;
      }
      return false;
    },

    isActive: () => phase.name !== "idle",
    close,
  };
}

/** The page's one script-to-quiz flow (#210). */
export const quizImport = createQuizImport();
