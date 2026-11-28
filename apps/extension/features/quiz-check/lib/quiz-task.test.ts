// @vitest-environment happy-dom
import type { QuizSnapshot } from "@nemu/contracts/quiz";
import { describe, expect, test } from "vite-plus/test";

import {
  nextQuizSteps,
  QUIZ_CHECK_KIND,
  type QuizContinuation,
  quizCheckTask,
  type QuizIo,
} from "./quiz-task";
import {
  attemptPage,
  editForm,
  PAGE_URLS,
  parse,
  questionsPage,
  settingsPage,
  viewPage,
} from "./test-pages";

const ASKED = { utterance: "cek kuis", honorific: "Bu" };

/** The browser for one run: the page shown now, and the pages Nemu reads without showing. */
function browserAt(html: string, url: string) {
  const fetched: string[] = [];
  const io: QuizIo & { show(html: string, url: string): void } = {
    doc: document,
    url: () => current,
    async fetchPage(address) {
      fetched.push(address);
      const id = Number(new URL(address).searchParams.get("id"));
      if (address.includes("editquestion"))
        return parse(editForm(id === 7 ? ["0.0", "0.0", "0.0", "0.0"] : ["1.0", "0.0", "0.0"]));
      const page = Number(new URL(address).searchParams.get("page"));
      const slot = page + 1;
      return parse(
        attemptPage(
          { [slot]: { images: slot === 15 ? ["timbangan-1.png", "timbangan-3.png"] : [] } },
          15,
          page,
        ),
      );
    },
    imageShown: async () => true,
    imageLoads: async (src) => !src.endsWith("timbangan-3.png"),
    sleep: async () => undefined,
    show(next, address) {
      document.documentElement.innerHTML = next;
      const bodyAttributes = parse(next).body;
      document.body.id = bodyAttributes.id;
      document.body.className = bodyAttributes.className;
      current = address;
    },
  };
  let current = url;
  io.show(html, url);
  return { io, fetched };
}

describe("F4-01 as an executor task (#209)", () => {
  test("from the quiz page: Setelan, Soal, back to Kuis, point at Pratinjau kuis, then read the preview", async () => {
    const { io, fetched } = browserAt(viewPage(), PAGE_URLS.view);
    const started = quizCheckTask(document, PAGE_URLS.view, {
      utterance: "Nemu, tolong cek kuis ini.",
      honorific: "Bu",
    });
    expect(started?.task).toEqual({
      kind: QUIZ_CHECK_KIND,
      title: "Cek kuis",
      source: "Halaman kuis di Moodle",
      steps: [{ verb: "clickMenu", target: { text: "Setelan" } }],
    });
    let continuation = started!.continuation as QuizContinuation | null;
    const verbs: string[] = [];
    let read: QuizSnapshot | null = null;
    const pages: [string, string][] = [
      [settingsPage(), PAGE_URLS.settings],
      [questionsPage(), PAGE_URLS.questions],
      [viewPage(), PAGE_URLS.view],
      [attemptPage({ 1: {} }, 15, 0), PAGE_URLS.attempt],
    ];
    for (const [html, url] of pages) {
      io.show(html, url);
      const next = await nextQuizSteps(io, continuation!, (quiz) => {
        read = quiz;
      });
      verbs.push(
        ...next.steps.map(
          (step) => `${step.verb} ${"text" in step.target ? step.target.text : ""}`,
        ),
      );
      if (next.steps[0]?.verb === "point")
        expect(next.steps[0].sentence).toBe(
          "Silakan Ibu tekan Pratinjau kuis. Nemu melihat kuis ini seperti siswa melihatnya.",
        );
      continuation = next.continuation;
    }
    // Only menus and one point: nothing on the quiz can change.
    expect(verbs).toEqual(["clickMenu Soal", "clickMenu Kuis", "point Pratinjau kuis"]);
    expect(continuation).toBeNull();
    expect(fetched.filter((address) => address.includes("editquestion"))).toHaveLength(15);
    expect(fetched).toContain(
      "https://localhost/question/bank/editquestion/question.php?cmid=3&id=7",
    );
    expect(fetched.filter((address) => address.includes("attempt.php"))).toHaveLength(14);

    const quiz = read as QuizSnapshot | null;
    expect(quiz).toMatchObject({
      name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
      course: "4A-UJI · Kelas 4A (uji)",
      section: "IPAS",
      opens: "2026-12-02T07:00",
      closes: "2026-12-04T21:00",
      maxGrade: 100,
      listed: 15,
    });
    expect(quiz?.questions).toHaveLength(15);
    expect(quiz?.questions[6]).toMatchObject({ slot: 7, name: "Soal 07", hasKey: false });
    expect(quiz?.questions[14]?.images).toEqual([
      { alt: "Gambar (1)", loaded: true },
      { alt: "Gambar (2)", loaded: false },
    ]);
  });

  test("from another page of the quiz, Nemu opens the quiz page first; off a quiz there is no task", () => {
    browserAt(questionsPage(), PAGE_URLS.questions);
    expect(quizCheckTask(document, PAGE_URLS.questions, ASKED)?.task.steps).toEqual([
      { verb: "clickMenu", target: { text: "Kuis" } },
    ]);
    browserAt("<body id='page-site-index'>Moodle</body>", "https://localhost/");
    expect(quizCheckTask(document, "https://localhost/", ASKED)).toBeNull();
  });

  test("an unfinished preview is continued with its own button", async () => {
    const { io } = browserAt(viewPage("Lanjutkan pratinjau terakhir"), PAGE_URLS.view);
    const next = await nextQuizSteps(
      io,
      {
        phase: "preview-start",
        cmid: 3,
        ...ASKED,
        facts: {
          name: "",
          course: "",
          section: "",
          opens: null,
          closes: null,
          maxGrade: null,
          listed: [],
        },
      },
      () => undefined,
    );
    expect(next.steps[0]).toMatchObject({
      verb: "point",
      target: { role: "button", text: "Lanjutkan pratinjau terakhir" },
    });
  });

  test("waits for the page the menu opens; the old page never gives the next steps", async () => {
    const { io } = browserAt(viewPage(), PAGE_URLS.view);
    let slept = 0;
    io.sleep = async (ms) => {
      slept += ms;
      if (slept >= 1000) io.show(settingsPage(), PAGE_URLS.settings);
    };
    const continuation = quizCheckTask(document, PAGE_URLS.view, ASKED)!.continuation;
    const next = await nextQuizSteps(io, continuation, () => undefined);
    expect(slept).toBe(1000);
    expect(next.continuation?.facts.closes).toBe("2026-12-04T21:00");
  });
});
