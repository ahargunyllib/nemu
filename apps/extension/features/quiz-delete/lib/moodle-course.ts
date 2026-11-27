import { quizPage } from "../../quiz-check/lib/moodle-pages";
import { type CourseQuiz, parseMoodleDay } from "./pick-quiz";

/**
 * Reads the Moodle 5.3 pages F4-06 goes through (#211): the course page with its quizzes, a
 * quiz's Hasil (results) page and the course page in Mode Edit, where each activity's Edit menu
 * holds Hapus. The readers only read; labels come from the page, in the site's language.
 */

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/** The quiz's secondary menu item that opens its results ("Hasil" in Indonesian). */
export const RESULTS_MENU = ["Hasil", "Results"] as const;

/** A course page (`/course/view.php`), in or out of Mode Edit. */
export function isCoursePage(doc: Document, url: string): boolean {
  if (!URL.canParse(url)) return false;
  return (
    new URL(url).pathname.endsWith("/course/view.php") &&
    !!doc.body?.classList.contains("path-course-view")
  );
}

/** Whether the course page is in Mode Edit, where activities have their Edit menus. */
export function isEditing(doc: Document): boolean {
  return !!doc.body?.classList.contains("editing");
}

/** The Mode Edit switch's label ("Mode Edit"), as the page names it. */
export function editModeLabel(doc: Document): string {
  return textOf(doc.querySelector(".editmode-switch-form label")) || "Mode Edit";
}

/** Each quiz the course page lists: its name, section and the days it opens and closes. */
export function readCourseQuizzes(doc: Document): CourseQuiz[] {
  return [...doc.querySelectorAll("li.activity.modtype_quiz")].flatMap((item) => {
    const cmid = Number(item.getAttribute("data-id") ?? item.id.replace(/^module-/u, ""));
    const card = item.querySelector("[data-activityname]");
    const name =
      card?.getAttribute("data-activityname")?.trim() ||
      textOf(item.querySelector(".instancename")).replace(/\s+(Kuis|Quiz)$/u, "");
    if (!cmid || !name) return [];
    const section = item.closest("[data-sectionname]")?.getAttribute("data-sectionname") ?? "";
    let opens: string | null = null;
    let closes: string | null = null;
    for (const date of item.querySelectorAll("[data-region='activity-dates'] .date-item")) {
      const label = textOf(date.querySelector(".date-item-label")).toLowerCase();
      const day = parseMoodleDay(textOf(date));
      if (/^(buka|dibuka|open)/u.test(label)) opens = day;
      else if (/^(tutup|ditutup|close)/u.test(label)) closes = day;
    }
    return [{ cmid, name, section: section.trim(), opens, closes }];
  });
}

/** A quiz's own page this is (any page of it), with its name from the page heading. */
export function quizHere(doc: Document, url: string): { cmid: number; name: string } | null {
  const page = quizPage(doc, url);
  if (!page) return null;
  const name = textOf(doc.querySelector(".page-header-headings h1, #page-header h1"));
  return name ? { cmid: page.cmid, name } : null;
}

/** The quiz's Hasil page (`/mod/quiz/report.php`). */
export function isResultsPage(doc: Document, url: string, cmid: number): boolean {
  const page = quizPage(doc, url);
  return !!page && page.cmid === cmid && new URL(url).pathname.endsWith("/mod/quiz/report.php");
}

/**
 * How many students took the quiz, from its Hasil page: the different students in the attempts
 * table, or, without the table, the number in "Yang telah mengerjakan: 3 orang". 0 when neither
 * is there, as Moodle shows no attempts then.
 */
export function readAttemptCount(doc: Document): number {
  const table = doc.querySelector("table#attempts");
  if (table) {
    const students = new Set(
      [...table.querySelectorAll("a[href*='/user/view.php']")].flatMap((link) => {
        const href = link.getAttribute("href") ?? "";
        if (!URL.canParse(href, "https://moodle.invalid")) return [];
        const id = new URL(href, "https://moodle.invalid").searchParams.get("id");
        return id ? [id] : [];
      }),
    );
    if (students.size > 0) return students.size;
  }
  const summary = textOf(doc.querySelector(".quizattemptcounts")).match(/\d+/u);
  return summary ? Number(summary[0]) : 0;
}

/** Where the count shows on the Hasil page, for Nemu to point at as it warns. */
export function attemptCountElement(doc: Document): Element | null {
  return doc.querySelector(".quizattemptcounts");
}

/** The course's link in the breadcrumb ("4A-UJI"), the way back to the course page. */
export function courseLinkText(doc: Document): string | null {
  return textOf(doc.querySelector(".breadcrumb a[href*='/course/view.php']")) || null;
}

/**
 * The activity's Edit menu button and its Hapus item on the course page in Mode Edit, by the
 * names the page gives them ("Edit", "Hapus"); null until the activity is listed in Mode Edit.
 */
export function deleteControls(
  doc: Document,
  cmid: number,
): { menu: string; remove: string } | null {
  const item = doc.getElementById(`module-${cmid}`);
  const toggle = item?.querySelector(".action-menu [data-bs-toggle='dropdown']");
  const remove = item?.querySelector(".action-menu [data-action='cmDelete']");
  if (!toggle || !remove) return null;
  const menu = toggle.getAttribute("aria-label")?.trim() || toggle.getAttribute("title")?.trim();
  return menu ? { menu, remove: textOf(remove) || "Hapus" } : null;
}
