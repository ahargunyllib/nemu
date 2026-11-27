/**
 * Reads the Moodle 5.3 pages F4-03 walks through (#210): the course page (its sections and edit
 * mode), the quiz settings form, the question bank's Impor page and its result, and the quiz's
 * Soal page. The readers only read; `dropFile` is the one thing here that hands Moodle anything.
 */

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function bodyNumber(doc: Document, prefix: string): number | null {
  const value = Number(doc.body?.className.match(new RegExp(`\\b${prefix}-(\\d+)\\b`, "u"))?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export type CoursePage = {
  courseId: number;
  /** "4A-UJI · Kelas 4A (uji)": the short name in the breadcrumb and the course's full name. */
  course: string;
  sections: string[];
  editing: boolean;
};

/** The course's own page (`/course/view.php`), or null anywhere else. */
export function coursePage(doc: Document, url: string): CoursePage | null {
  if (!URL.canParse(url) || !new URL(url).pathname.endsWith("/course/view.php")) return null;
  const courseId = bodyNumber(doc, "course");
  if (!courseId || !doc.body.classList.contains("path-course-view")) return null;
  const sections = [
    ...doc.querySelectorAll("li.section[data-sectionname], [data-for=section][data-sectionname]"),
  ]
    .map((section) => section.getAttribute("data-sectionname")?.trim() ?? "")
    .filter((name, index, all) => name && all.indexOf(name) === index);
  const crumb = textOf(doc.querySelector(".breadcrumb a[href*='/course/view.php']"));
  const heading = textOf(doc.querySelector(".page-header-headings h1, #page-header h1"));
  return {
    courseId,
    course: [crumb, heading].filter(Boolean).join(" · "),
    sections,
    editing: doc.body.classList.contains("editing"),
  };
}

/** The new quiz's settings form (`modedit.php?add=quiz`, reached through the activity chooser). */
export function isNewQuizForm(doc: Document, url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { pathname } = new URL(url);
  return (
    (pathname.endsWith("/course/modedit.php") || pathname.endsWith("/course/mod.php")) &&
    doc.body?.id === "page-mod-quiz-mod" &&
    !!doc.getElementById("id_name")
  );
}

/** The text of a select's option by its value ("11" → "November"), to name it as Moodle shows it. */
export function optionText(doc: Document, selectId: string, value: string): string {
  const select = doc.getElementById(selectId);
  if (!(select instanceof HTMLSelectElement)) return value;
  const option = [...select.options].find((candidate) => candidate.value === value);
  return option?.text.trim() || value;
}

/** A quiz's page and its course module id; `kind` as F4-01's `quizPage` names them. */
export function quizModule(doc: Document, url: string): { cmid: number; path: string } | null {
  if (!URL.canParse(url)) return null;
  const cmid = bodyNumber(doc, "cmid");
  if (!cmid) return null;
  return { cmid, path: new URL(url).pathname };
}

/** The question bank's Impor form (`question/bank/importquestions/import.php`) with its picker. */
export function isImportForm(doc: Document, url: string): boolean {
  return (
    URL.canParse(url) &&
    new URL(url).pathname.endsWith("/question/bank/importquestions/import.php") &&
    !!doc.getElementById("id_format_xml") &&
    !!doc.querySelector(".filepicker-filelist")
  );
}

/** After Impor: how many questions Moodle says it imported, or `error` with Moodle's own words. */
export function importResult(
  doc: Document,
  url: string,
): { status: "imported"; count: number | null } | { status: "error"; message: string } | null {
  if (
    !URL.canParse(url) ||
    !new URL(url).pathname.endsWith("/question/bank/importquestions/import.php")
  )
    return null;
  if (doc.getElementById("id_format_xml")) {
    const error = textOf(doc.querySelector("#region-main .alert-danger, #region-main .error"));
    return error ? { status: "error", message: error } : null;
  }
  const main = textOf(doc.querySelector("#region-main"));
  const count = Number(main.match(/(?:Mengimpor|Importing)\s+(\d+)\s+(?:soal|questions?)/iu)?.[1]);
  const error = textOf(doc.querySelector("#region-main .alert-danger, #region-main .errorbox"));
  if (error && !Number.isInteger(count)) return { status: "error", message: error };
  return { status: "imported", count: Number.isInteger(count) ? count : null };
}

/** The file name the Impor picker holds now, or null while it holds none. */
export function pickedFile(doc: Document): string | null {
  const list = doc.querySelector(".filepicker-filelist .filepicker-filename");
  if (!list || list.querySelector(".dndupload-message")?.checkVisibility?.()) return null;
  const name = textOf(list.querySelector("a")) || textOf(list);
  return name && !/seret dan lepas|drag and drop/iu.test(name) ? name : null;
}

/**
 * The spike (#210): the XML handed to the Impor picker as if the teacher dropped it there. Moodle's
 * own drag-and-drop upload takes it, so no file dialog opens. The caller checks `pickedFile`.
 */
export function dropFile(doc: Document, file: File): boolean {
  const target = doc.querySelector(".filepicker-filelist");
  if (!target) return false;
  const data = new DataTransfer();
  data.items.add(file);
  for (const type of ["dragenter", "dragover", "drop"])
    target.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
    );
  return true;
}

/** Soal (the quiz's question list): how many questions it holds. */
export function listedQuestions(doc: Document): number {
  return doc.querySelectorAll("li.slot").length;
}

/**
 * The header link that opens the collapsed part of a form holding `elementId` ("Umum", "Waktu
 * Pengerjaan"), or null when that part is already open.
 */
export function collapsedHeaderFor(doc: Document, elementId: string): string | null {
  const container = doc.getElementById(elementId)?.closest(".collapse:not(.show)");
  if (!container?.id) return null;
  return textOf(doc.querySelector(`a[href='#${container.id}'][data-bs-toggle=collapse]`)) || null;
}

/** The visible name of the group a date field sits in ("Kuis dimulai"), from its legend. */
export function legendOf(doc: Document, fieldsetId: string, fallback: string): string {
  return textOf(doc.querySelector(`#${fieldsetId} > legend`)) || fallback;
}
