/**
 * Moodle 5.3 pages for the F4-06 tests, cut down from the local test site (infra/) to the markup
 * the readers use: course 4A-UJI with the F4-1 quiz in IPAS and the two F4-3 quizzes in Bahasa
 * Inggris, the Hasil page of "Latihan: My Family (has/have)" and the course page in Mode Edit.
 */

const BASE = "https://localhost";

export const URLS = {
  course: `${BASE}/course/view.php?id=2`,
  view: `${BASE}/mod/quiz/view.php?id=4`,
  results: `${BASE}/mod/quiz/report.php?id=4&mode=overview`,
} as const;

type Quiz = { cmid: number; name: string; opens: string; closes: string; opensLabel?: string };

const IPAS: Quiz = {
  cmid: 3,
  name: "Kuis IPAS 4A: Energi, Gaya, dan Peta",
  opens: "Wednesday, 2 December 2026, 07:00",
  closes: "Friday, 4 December 2026, 21:00",
};
const MY_FAMILY: Quiz = {
  cmid: 4,
  name: "Latihan: My Family (has/have)",
  opens: "Monday, 30 November 2026, 07:00",
  closes: "Friday, 4 December 2026, 21:00",
};
const DECOY: Quiz = {
  cmid: 5,
  name: "Parts of Body + Family (pengecoh)",
  opensLabel: "Dibuka:",
  opens: "Monday, 23 November 2026, 07:00",
  closes: "Friday, 27 November 2026, 21:00",
};

function activity(quiz: Quiz, editing: boolean): string {
  const menu = editing
    ? `<div class="cm_action_menu actions"><div class="action-menu moodle-actionmenu"><div class="dropdown">
        <a href="#" id="action-menu-toggle-${quiz.cmid}" aria-label="Edit" title="Edit" role="button" data-bs-toggle="dropdown"></a>
        <div class="dropdown-menu" role="menu">
          <a href="${BASE}/course/mod.php?update=${quiz.cmid}" class="dropdown-item" role="menuitem">Edit pengaturan</a>
          <a href="${BASE}/course/format/update.php?action=cm_delete&id=${quiz.cmid}" class="dropdown-item editing_delete text-danger" data-action="cmDelete" role="menuitem">Hapus</a>
        </div>
      </div></div></div>`
    : "";
  return `<li class="activity quiz modtype_quiz" id="module-${quiz.cmid}" data-for="cmitem" data-id="${quiz.cmid}">
    <div class="activity-item" data-activityname="${quiz.name}" data-region="activity-card">
      <div class="activityname"><a href="${BASE}/mod/quiz/view.php?id=${quiz.cmid}" class="aalink stretched-link">
        <span class="instancename">${quiz.name} <span class="accesshide"> Kuis</span></span></a></div>
      ${menu}
      <div data-region="activity-dates" class="activity-dates">
        <div class="date-item"><span class="date-item-label">${quiz.opensLabel ?? "Buka:"}</span> ${quiz.opens}</div>
        <div class="date-item"><span class="date-item-label">Tutup:</span> ${quiz.closes}</div>
      </div>
    </div>
  </li>`;
}

export function coursePage(editing = false): string {
  return `<body id="page-course-view-topics" class="format-topics path-course path-course-view lang-id course-2${editing ? " editing" : ""}">
    <form action="${BASE}/editmode.php" method="post" class="editmode-switch-form">
      <input id="editingswitch" role="switch" type="checkbox" name="setmode"${editing ? " checked" : ""}>
      <label for="editingswitch"><span class="mds-switch-label">Mode Edit</span></label>
    </form>
    <ul class="topics">
      <li class="section course-section" data-sectionname="IPAS"><ul data-for="cmlist">${activity(IPAS, editing)}</ul></li>
      <li class="section course-section" data-sectionname="Bahasa Inggris"><ul data-for="cmlist">
        ${activity(MY_FAMILY, editing)}${activity(DECOY, editing)}
      </ul></li>
    </ul>
  </body>`;
}

function quizBody(id: string, content: string): string {
  return `<body id="${id}" class="format-topics path-mod path-mod-quiz lang-id course-2 cmid-4 cm-type-quiz">
    <nav aria-label="Bilah navigasi"><ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="${BASE}/course/view.php?id=2" title="Kelas 4A (uji)"> 4A-UJI </a></li>
      <li class="breadcrumb-item"><a href="${BASE}/course/section.php?id=3"> Bahasa Inggris </a></li>
      <li class="breadcrumb-item"><span> Latihan: My Family (has/have) </span></li>
    </ol></nav>
    <div class="page-header-headings"><h1 class="h2 mb-0">Latihan: My Family (has/have)</h1></div>
    <div class="secondary-navigation"><ul role="menubar">
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/view.php?id=4">Kuis</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/course/modedit.php?update=4&return=1">Setelan</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/edit.php?cmid=4">Soal</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/report.php?id=4&mode=overview">Hasil</a></li>
    </ul></div>
    ${content}
  </body>`;
}

export function viewPage(): string {
  return quizBody(
    "page-mod-quiz-view",
    `<div class="quizattemptcounts"><a href="${BASE}/mod/quiz/report.php?id=4&mode=overview">Yang telah mengerjakan: 3 orang</a></div>`,
  );
}

/** Hasil with each student's attempts; a student may have more than one. */
export function resultsPage(attemptsByStudent: number[] = [1, 1, 1]): string {
  const rows = attemptsByStudent.flatMap((attempts, index) =>
    Array.from(
      { length: attempts },
      () =>
        `<tr><td><a href="${BASE}/user/view.php?id=${index + 4}&course=2">Siswa ${index + 1}</a></td><td>Selesai</td></tr>`,
    ),
  );
  const total = attemptsByStudent.reduce((sum, attempts) => sum + attempts, 0);
  return quizBody(
    "page-mod-quiz-report",
    total === 0
      ? ""
      : `<div class="quizattemptcounts">Yang telah mengerjakan: ${total} orang</div>
        <table class="generaltable" id="attempts"><tbody>${rows.join("")}</tbody></table>`,
  );
}

export function parse(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html>${html}</html>`, "text/html");
}
