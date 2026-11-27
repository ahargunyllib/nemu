// @vitest-environment happy-dom
import { describe, expect, test } from "vite-plus/test";

import {
  menuLabel,
  previewButton,
  previewPageUrl,
  questionTarget,
  quizPage,
  readAnswerKey,
  readPreviewPages,
  readPreviewQuestions,
  readQuestionsPage,
  readQuizHeader,
  readSettingsPage,
} from "./moodle-pages";
import {
  attemptPage,
  editForm,
  PAGE_URLS,
  parse,
  questionsPage,
  settingsPage,
  viewPage,
} from "./test-pages";

describe("the Moodle quiz pages (F4-01)", () => {
  test("tells each page of a quiz apart, and anything else is not a quiz", () => {
    expect(quizPage(parse(viewPage()), PAGE_URLS.view)).toEqual({ kind: "view", cmid: 3 });
    expect(quizPage(parse(settingsPage()), PAGE_URLS.settings)).toEqual({
      kind: "settings",
      cmid: 3,
    });
    expect(quizPage(parse(questionsPage()), PAGE_URLS.questions)).toEqual({
      kind: "questions",
      cmid: 3,
    });
    expect(quizPage(parse(attemptPage({ 1: {} })), PAGE_URLS.attempt)).toEqual({
      kind: "attempt",
      cmid: 3,
    });
    const course = parse(
      `<body id="page-course-view-topics" class="path-course course-2">x</body>`,
    );
    expect(quizPage(course, "https://localhost/course/view.php?id=2")).toBeNull();
    const forum = parse(`<body id="page-mod-forum-mod" class="path-mod-forum cmid-9"></body>`);
    expect(quizPage(forum, "https://localhost/course/modedit.php?update=9")).toBeNull();
  });

  test("reads the quiz's name and where it is from the breadcrumb", () => {
    expect(readQuizHeader(parse(viewPage()))).toEqual({
      name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
      course: "4A-UJI · Kelas 4A (uji)",
      section: "IPAS",
    });
  });

  test("names the menu item in the site's language and finds the preview button", () => {
    const doc = parse(viewPage());
    expect(menuLabel(doc, ["Setelan", "Settings"])).toBe("Setelan");
    expect(
      menuLabel(parse("<body><a role='menuitem'>Settings</a></body>"), ["Setelan", "Settings"]),
    ).toBe("Settings");
    expect(previewButton(doc)).toBe("Pratinjau kuis");
    expect(previewButton(parse(viewPage("Lanjutkan pratinjau terakhir")))).toBe(
      "Lanjutkan pratinjau terakhir",
    );
  });

  test("reads Setelan's open and close times, and a time that is switched off as none", () => {
    expect(readSettingsPage(parse(settingsPage()))).toEqual({
      opens: "2026-12-02T07:00",
      closes: "2026-12-04T21:00",
    });
    expect(readSettingsPage(parse(settingsPage(undefined, undefined, false))).closes).toBeNull();
  });

  test("reads Soal: every slot in order with its question, and the maximum grade", () => {
    const { questions, maxGrade } = readQuestionsPage(parse(questionsPage()));
    expect(maxGrade).toBe(100);
    expect(questions).toHaveLength(15);
    expect(questions[6]).toEqual({ slot: 7, name: "Soal 07", questionId: 7 });
  });

  test("a question whose answers are all graded Tidak ada has no key", () => {
    expect(readAnswerKey(parse(editForm(["0.0", "0.0", "0.0", "0.0"])))).toBe(false);
    expect(readAnswerKey(parse(editForm(["1.0", "0.0", "0.0", "0.0"])))).toBe(true);
    // Several right answers sharing the grade (multiple choice with more than one answer).
    expect(readAnswerKey(parse(editForm(["0.5", "0.5", "-0.5"])))).toBe(true);
    // Essay: no graded answers to read.
    expect(
      readAnswerKey(parse("<body><form><textarea name='graderinfo'></textarea></form></body>")),
    ).toBeNull();
  });

  test("reads the preview: its questions with their images, and the pages in Navigasi kuis", () => {
    const doc = parse(
      attemptPage({ 15: { images: ["timbangan-1.png", "timbangan-3.png"] } }, 15, 14),
    );
    const [question] = readPreviewQuestions(doc);
    expect(question?.slot).toBe(15);
    // The flag icon in the question's header is not one of its images.
    expect(question?.images.map((image) => image.alt)).toEqual(["Gambar (1)", "Gambar (2)"]);
    const { attempt, pages, slots } = readPreviewPages(doc, `${PAGE_URLS.attempt}&page=14`);
    expect(attempt).toBe("1");
    expect(pages).toEqual([...Array(15).keys()]);
    expect(slots).toEqual([...Array(15).keys()].map((index) => index + 1));
    expect(previewPageUrl(`${PAGE_URLS.attempt}#q`, 6)).toBe(`${PAGE_URLS.attempt}&page=6`);
  });

  test("points at a question on this page, else at its button in Navigasi kuis", () => {
    const doc = parse(attemptPage({ 1: {} }));
    expect(questionTarget(doc, 1, "no_key")?.classList.contains("ablock")).toBe(true);
    expect(questionTarget(doc, 7, "no_key")?.id).toBe("quiznavbutton7");
    expect(questionTarget(doc, 40, "other")).toBeNull();
  });
});
