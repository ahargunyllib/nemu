// @vitest-environment happy-dom
import type { ExecutorStep } from "@nemu/contracts/executor";
import { describe, expect, test } from "vite-plus/test";

import { refusalFor } from "../../executor/lib/safety";
import { findTarget } from "../../executor/lib/find-target";
import {
  COUNT_KIND,
  type CountContinuation,
  countTask,
  type DeleteIo,
  nextCountSteps,
  nextShowSteps,
  SHOW_DELETE_KIND,
  type ShowContinuation,
  showDeleteTask,
} from "./delete-task";
import {
  attemptCountElement,
  deleteControls,
  isEditing,
  readAttemptCount,
  readCourseQuizzes,
} from "./moodle-course";
import { pickQuiz } from "./pick-quiz";
import { coursePage, parse, resultsPage, URLS, viewPage } from "./test-pages";

const QUIZ = { cmid: 4, name: "Latihan: My Family (has/have)" };

/** The tab: the page shown now, swapped as Nemu's clicks open the next one. */
function browserAt(html: string, url: string) {
  let current = url;
  const io: DeleteIo & { show(html: string, url: string): void } = {
    doc: document,
    url: () => current,
    sleep: async () => undefined,
    show(next, address) {
      document.documentElement.innerHTML = next;
      const body = parse(next).body;
      document.body.id = body.id;
      document.body.className = body.className;
      current = address;
    },
  };
  io.show(html, url);
  return io;
}

describe("Moodle readers (F4-06)", () => {
  test("the course page lists each quiz with its section and days", () => {
    browserAt(coursePage(), URLS.course);
    expect(readCourseQuizzes(document)).toEqual([
      {
        cmid: 3,
        name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
        section: "IPAS",
        opens: "2026-12-02",
        closes: "2026-12-04",
      },
      {
        cmid: 4,
        name: "Latihan: My Family (has/have)",
        section: "Bahasa Inggris",
        opens: "2026-11-30",
        closes: "2026-12-04",
      },
      {
        cmid: 5,
        name: "Parts of Body + Family (pengecoh)",
        section: "Bahasa Inggris",
        opens: "2026-11-23",
        closes: "2026-11-27",
      },
    ]);
    expect(
      pickQuiz(
        readCourseQuizzes(document),
        "Tolong hapus latihan bahasa Inggris yang kemarin.",
        "2026-12-01",
      ),
    ).toMatchObject({ kind: "one", quiz: { cmid: 4 } });
  });

  test("Hasil counts students, not attempts, and 0 when nobody took it", () => {
    browserAt(resultsPage(), URLS.results);
    expect(readAttemptCount(document)).toBe(3);
    expect(attemptCountElement(document)?.textContent).toBe("Yang telah mengerjakan: 3 orang");
    browserAt(resultsPage([2, 1, 1]), URLS.results);
    expect(readAttemptCount(document)).toBe(3);
    browserAt(resultsPage([]), URLS.results);
    expect(readAttemptCount(document)).toBe(0);
  });

  test("in Mode Edit each quiz has its own Edit menu with Hapus", () => {
    browserAt(coursePage(), URLS.course);
    expect(isEditing(document)).toBe(false);
    expect(deleteControls(document, 4)).toBeNull();
    browserAt(coursePage(true), URLS.course);
    expect(deleteControls(document, 4)).toEqual({ menu: "Edit", remove: "Hapus" });
  });
});

describe("counting before deleting (F4-06)", () => {
  test("from the course page: open the quiz, then Hasil, then read 3 students", async () => {
    const io = browserAt(coursePage(), URLS.course);
    const started = countTask(document, URLS.course, QUIZ);
    expect(started.task).toEqual({
      kind: COUNT_KIND,
      title: "Cek siswa sebelum hapus kuis",
      source: "Halaman Hasil kuis di Moodle",
      steps: [{ verb: "clickMenu", target: { role: "link", text: QUIZ.name } }],
    });
    // The quiz's own link on the course page, not the decoy's.
    const lookup = findTarget(document, started.task.steps[0]!.target);
    expect(lookup.status === "found" && lookup.element.getAttribute("href")).toBe(URLS.view);

    io.show(viewPage(), URLS.view);
    let counted: number | null = null;
    const toResults = await nextCountSteps(io, started.continuation, () => undefined);
    expect(toResults.steps).toEqual([{ verb: "clickMenu", target: { text: "Hasil" } }]);

    io.show(resultsPage(), URLS.results);
    const read = await nextCountSteps(
      io,
      toResults.continuation as CountContinuation,
      (quiz, count) => {
        expect(quiz).toEqual(QUIZ);
        counted = count;
      },
    );
    expect(read).toEqual({ steps: [], continuation: null });
    expect(counted).toBe(3);
  });

  test("on the quiz's own pages it opens Hasil, or reads it at once", () => {
    browserAt(viewPage(), URLS.view);
    expect(countTask(document, URLS.view, QUIZ).task.steps).toEqual([
      { verb: "clickMenu", target: { text: "Hasil" } },
    ]);
    browserAt(resultsPage(), URLS.results);
    expect(countTask(document, URLS.results, QUIZ)).toMatchObject({
      task: { steps: [] },
      continuation: { phase: "results" },
    });
  });

  test("every counting step is a menu click: nothing on the quiz changes", async () => {
    const io = browserAt(coursePage(), URLS.course);
    const started = countTask(document, URLS.course, QUIZ);
    io.show(viewPage(), URLS.view);
    const more = await nextCountSteps(io, started.continuation, () => undefined);
    const verbs = [...started.task.steps, ...more.steps].map((step) => step.verb);
    expect(new Set(verbs)).toEqual(new Set(["clickMenu"]));
  });
});

describe("Tunjukkan tombol Hapus (F4-06)", () => {
  test("back to the course, Mode Edit, the quiz's Edit menu, then only a point at Hapus", async () => {
    const io = browserAt(resultsPage(), URLS.results);
    const started = showDeleteTask(document, QUIZ, 3, "Bu");
    expect(started.task).toMatchObject({
      kind: SHOW_DELETE_KIND,
      source: "Halaman Hasil: 3 siswa sudah mengerjakan Latihan: My Family (has/have)",
      steps: [{ verb: "clickMenu", target: { role: "link", text: "4A-UJI" } }],
    });

    io.show(coursePage(), URLS.course);
    // After the page load the identity may not be back yet: she is still "Bu".
    const edit = await nextShowSteps(io, started.continuation, () => "");
    expect(edit.steps).toEqual([
      { verb: "check", target: { role: "checkbox", label: "Mode Edit" }, checked: true },
    ]);

    io.show(coursePage(true), URLS.course);
    const last = await nextShowSteps(io, edit.continuation as ShowContinuation, () => "");
    expect(last.continuation).toBeNull();
    expect(last.steps).toEqual([
      { verb: "clickMenu", target: { role: "button", label: "Edit", near: QUIZ.name } },
      {
        verb: "point",
        target: { role: "menuitem", text: "Hapus", near: QUIZ.name },
        sentence: "Kalau jadi dihapus, tekan Hapus sendiri, Bu.",
      },
    ]);
    // The Edit menu is this quiz's, not the decoy's.
    const menu = findTarget(document, last.steps[0]!.target);
    expect(menu.status === "found" && menu.element.id).toBe("action-menu-toggle-4");
  });

  test("already in Mode Edit, Nemu goes straight to the menu", async () => {
    const io = browserAt(coursePage(true), URLS.course);
    const steps = await nextShowSteps(
      io,
      { ...QUIZ, count: 3, honorific: "", phase: "course" },
      () => "",
    );
    expect(steps.steps.map((step) => step.verb)).toEqual(["clickMenu", "point"]);
    expect((steps.steps[1] as Extract<ExecutorStep, { verb: "point" }>).sentence).toBe(
      "Kalau jadi dihapus, tekan Hapus sendiri.",
    );
  });

  test("F0-08 holds even if Hapus were asked to be pressed: the executor refuses it", () => {
    browserAt(coursePage(true), URLS.course);
    const hapus = document.querySelector("#module-4 [data-action='cmDelete']")!;
    expect(refusalFor({ verb: "clickMenu", target: { text: "Hapus" } }, hapus)).toBe("denied_name");
  });
});
