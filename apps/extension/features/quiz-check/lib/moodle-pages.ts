/**
 * Reads the Moodle quiz pages F4-01 opens (#209): the quiz page, Setelan, Soal, a question's edit
 * form and the preview a student would see. Moodle 5.3 markup; the readers only read and never
 * press anything. Labels come in Indonesian and English, as the site's language may be either.
 */

export type QuizPageKind = "view" | "settings" | "questions" | "attempt" | "other";

/** Which quiz page this is, and the quiz's course module id; null off a quiz. */
export function quizPage(doc: Document, url: string): { kind: QuizPageKind; cmid: number } | null {
  if (!URL.canParse(url)) return null;
  const { pathname, searchParams } = new URL(url);
  const fromBody = Number(doc.body?.className.match(/\bcmid-(\d+)\b/u)?.[1]);
  if (pathname.endsWith("/course/modedit.php")) {
    const cmid = Number(searchParams.get("update"));
    const quiz = doc.body?.id === "page-mod-quiz-mod";
    return quiz && cmid ? { kind: "settings", cmid } : null;
  }
  if (!doc.body?.classList.contains("path-mod-quiz") || !fromBody) return null;
  const kind: QuizPageKind = pathname.endsWith("/mod/quiz/view.php")
    ? "view"
    : pathname.endsWith("/mod/quiz/edit.php")
      ? "questions"
      : pathname.endsWith("/mod/quiz/attempt.php")
        ? "attempt"
        : "other";
  return { kind, cmid: fromBody };
}

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/** The secondary menu item that exists here, in the site's language ("Setelan" or "Settings"). */
export function menuLabel(doc: Document, labels: readonly string[]): string {
  const items = [...doc.querySelectorAll("a[role=menuitem], .secondary-navigation a")].map(textOf);
  return labels.find((label) => items.includes(label)) ?? labels[0]!;
}

export const MENU = {
  quiz: ["Kuis", "Quiz"],
  settings: ["Setelan", "Settings"],
  questions: ["Soal", "Questions"],
} as const;

/** The quiz page's button that opens the preview; an unfinished preview is continued instead. */
export const PREVIEW_BUTTONS = [
  "Pratinjau kuis",
  "Lanjutkan pratinjau terakhir",
  "Preview quiz",
  "Continue the last preview",
] as const;

export function previewButton(doc: Document): string | null {
  const buttons = [...doc.querySelectorAll("button, input[type=submit]")].map((button) =>
    button instanceof HTMLInputElement ? button.value.trim() : textOf(button),
  );
  return PREVIEW_BUTTONS.find((label) => buttons.includes(label)) ?? null;
}

/** What every quiz page shows: its name and where it sits (breadcrumb: course › section › quiz). */
export function readQuizHeader(doc: Document): { name: string; course: string; section: string } {
  const crumbs = [...doc.querySelectorAll(".breadcrumb .breadcrumb-item")].map(textOf);
  const courseLink = doc.querySelector(".breadcrumb a[href*='/course/view.php']");
  const course = [textOf(courseLink), courseLink?.getAttribute("title") ?? ""]
    .filter(Boolean)
    .join(" · ");
  return {
    name: textOf(doc.querySelector(".page-header-headings h1, #page-header h1")),
    course,
    section: crumbs.length >= 3 ? (crumbs[crumbs.length - 2] ?? "") : "",
  };
}

function selected(doc: Document, id: string): string | null {
  const select = doc.getElementById(id);
  return select instanceof HTMLSelectElement ? select.value : null;
}

/** "2026-12-02T07:00" from Setelan's date fields, or null when the time isn't switched on. */
function settingTime(doc: Document, name: "timeopen" | "timeclose"): string | null {
  const enabled = doc.getElementById(`id_${name}_enabled`);
  if (!(enabled instanceof HTMLInputElement) || !enabled.checked) return null;
  const parts = ["year", "month", "day", "hour", "minute"].map((part) =>
    selected(doc, `id_${name}_${part}`),
  );
  if (parts.some((part) => part === null)) return null;
  const [year, month, day, hour, minute] = parts.map((part) => (part ?? "").padStart(2, "0"));
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Setelan (the quiz's settings form): its open and close times. Nothing is saved. */
export function readSettingsPage(doc: Document): { opens: string | null; closes: string | null } {
  return { opens: settingTime(doc, "timeopen"), closes: settingTime(doc, "timeclose") };
}

export type ListedQuestion = { slot: number; name: string; questionId: number | null };

/** "100,00" (Indonesian) or "100.00" → 100. */
function parseGrade(value: string): number | null {
  const plain = value.trim();
  const number = Number(plain.includes(",") ? plain.replace(/\./gu, "").replace(",", ".") : plain);
  return plain && Number.isFinite(number) ? number : null;
}

/** Soal (the quiz's question list): each slot in order, and the quiz's maximum grade. */
export function readQuestionsPage(doc: Document): {
  questions: ListedQuestion[];
  maxGrade: number | null;
} {
  const questions = [...doc.querySelectorAll("li.slot")].map((slot, index) => {
    const edit = slot.querySelector("a[href*='editquestion/question.php']");
    const href = edit?.getAttribute("href") ?? "";
    const id = URL.canParse(href, "https://moodle.invalid")
      ? Number(new URL(href, "https://moodle.invalid").searchParams.get("id"))
      : NaN;
    return {
      // Soal lists the slots in order; the element's id (`slot-21`) is Moodle's database id.
      slot: index + 1,
      name: textOf(slot.querySelector(".questionname")),
      questionId: Number.isInteger(id) && id > 0 ? id : null,
    };
  });
  const grade = doc.getElementById("inputmaxgrade");
  return {
    questions,
    maxGrade: grade instanceof HTMLInputElement ? parseGrade(grade.value) : null,
  };
}

/**
 * A question's edit form: whether any answer carries a grade above 0. Null for a type whose key
 * isn't a graded answer (essay, matching) or a true/false question, which always has one.
 */
export function readAnswerKey(doc: Document): boolean | null {
  const grades = [...doc.querySelectorAll("select[name^='fraction[']")];
  if (grades.length === 0) return null;
  return grades.some((select) => select instanceof HTMLSelectElement && Number(select.value) > 0);
}

export type PreviewQuestion = { slot: number; text: string; images: HTMLImageElement[] };

/** The questions on one preview page, each with the images a student would see in it. */
export function readPreviewQuestions(doc: Document): PreviewQuestion[] {
  return [...doc.querySelectorAll(".que")].flatMap((box) => {
    const slot = Number(box.id.match(/^question-\d+-(\d+)$/u)?.[1]);
    if (!slot) return [];
    return [
      {
        slot,
        text: textOf(box.querySelector(".qtext")).slice(0, 4000),
        images: [...box.querySelectorAll(".formulation img")] as HTMLImageElement[],
      },
    ];
  });
}

/** The preview's pages: the attempt id and each page's number, from Navigasi kuis. */
export function readPreviewPages(
  doc: Document,
  url: string,
): { attempt: string | null; pages: number[]; slots: number[] } {
  const attempt = URL.canParse(url) ? new URL(url).searchParams.get("attempt") : null;
  const buttons = [...doc.querySelectorAll("a.qnbutton, .qn_buttons .qnbutton")];
  const pages = new Set<number>();
  const slots: number[] = [];
  for (const button of buttons) {
    const page = Number(button.getAttribute("data-quiz-page"));
    if (Number.isInteger(page)) pages.add(page);
    const slot = Number(button.id.match(/^quiznavbutton(\d+)$/u)?.[1]);
    if (slot) slots.push(slot);
  }
  return { attempt, pages: [...pages].sort((a, b) => a - b), slots };
}

/** The preview page that `slot` is on, for Moodle's own address of it. */
export function previewPageUrl(url: string, page: number): string {
  const next = new URL(url);
  next.searchParams.set("page", String(page));
  next.hash = "";
  return next.href;
}

/** Whether an image on the page loaded; one still loading is waited for. */
export function imageLoaded(image: HTMLImageElement, timeoutMs = 8000): Promise<boolean> {
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);
  return new Promise((resolve) => {
    const done = () => resolve(image.naturalWidth > 0);
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", () => resolve(false), { once: true });
    setTimeout(done, timeoutMs);
  });
}

/**
 * Where to point for a question on the preview: its broken image or its answers when the question
 * is on this page, else its button in Navigasi kuis. Null when neither is here.
 */
export function questionTarget(
  doc: Document,
  slot: number,
  kind: "missing_image" | "no_key" | "other",
): Element | null {
  const box = [...doc.querySelectorAll(".que")].find((element) =>
    new RegExp(`^question-\\d+-${slot}$`, "u").test(element.id),
  );
  if (box) {
    if (kind === "missing_image") {
      const broken = [...box.querySelectorAll<HTMLImageElement>(".formulation img")].find(
        (image) => image.complete && image.naturalWidth === 0,
      );
      if (broken) return broken;
    }
    if (kind === "no_key") return box.querySelector(".ablock, .answer") ?? box;
    return box;
  }
  return doc.getElementById(`quiznavbutton${slot}`);
}

/** The quiz's name on the page, for a problem about the whole quiz. */
export function quizHeading(doc: Document): Element | null {
  return doc.querySelector(".page-header-headings h1, #page-header h1, h1");
}
