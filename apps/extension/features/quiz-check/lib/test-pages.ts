/**
 * Moodle 5.3 quiz pages for the F4-01 tests, cut down from the local test site (infra/) to the
 * markup the readers use: the F4-1 quiz "Kuis IPAS 4A: Energi, Gaya, dan Peta" in 4A-UJI › IPAS.
 */

const BASE = "https://localhost";

function body(id: string, content: string): string {
  return `<body id="${id}" class="format-topics path-mod path-mod-quiz lang-id course-2 cmid-3 cm-type-quiz">
    <div id="page-navbar"><nav aria-label="Bilah navigasi"><ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="${BASE}/course/view.php?id=2" title="Kelas 4A (uji)"> 4A-UJI </a></li>
      <li class="breadcrumb-item"><a href="${BASE}/course/section.php?id=2"> IPAS </a></li>
      <li class="breadcrumb-item"><span> Kuis IPAS 4A: Energi, Gaya, dan Peta </span></li>
    </ol></nav></div>
    <div class="page-header-headings"><h1 class="h2 mb-0">Kuis IPAS 4A: Energi, Gaya, dan Peta</h1></div>
    <div class="secondary-navigation"><ul role="menubar">
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/view.php?id=3">Kuis</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/course/modedit.php?update=3&return=1">Setelan</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/edit.php?cmid=3">Soal</a></li>
      <li role="none"><a role="menuitem" href="${BASE}/mod/quiz/report.php?id=3">Hasil</a></li>
    </ul></div>
    ${content}
  </body>`;
}

export const PAGE_URLS = {
  view: `${BASE}/mod/quiz/view.php?id=3`,
  settings: `${BASE}/course/modedit.php?update=3&return=1`,
  questions: `${BASE}/mod/quiz/edit.php?cmid=3`,
  attempt: `${BASE}/mod/quiz/attempt.php?attempt=1&cmid=3`,
} as const;

export function viewPage(button = "Pratinjau kuis"): string {
  return body(
    "page-mod-quiz-view",
    `<div class="activity-dates">
      <div class="date-item"><span class="date-item-label">Buka:</span> Wednesday, 2 December 2026, 07:00</div>
      <div class="date-item"><span class="date-item-label">Tutup:</span> Friday, 4 December 2026, 21:00</div>
    </div>
    <form method="post" action="${BASE}/mod/quiz/startattempt.php">
      <input type="hidden" name="cmid" value="3"><button type="submit" class="btn btn-primary">${button}</button>
    </form>`,
  );
}

function dateFields(name: string, [year, month, day, hour, minute]: number[], enabled: boolean) {
  const select = (part: string, value: number | undefined) =>
    `<select name="${name}[${part}]" id="id_${name}_${part}"><option value="0">0</option><option value="${value}" selected>${value}</option></select>`;
  return `${select("day", day)}${select("month", month)}${select("year", year)}${select("hour", hour)}${select("minute", minute)}
    <input type="checkbox" name="${name}[enabled]" id="id_${name}_enabled" value="1" ${enabled ? "checked" : ""}>`;
}

export function settingsPage(
  opens: number[] = [2026, 12, 2, 7, 0],
  closes: number[] = [2026, 12, 4, 21, 0],
  closeEnabled = true,
): string {
  return body(
    "page-mod-quiz-mod",
    `<form><input id="id_name" name="name" value="Kuis IPAS 4A: Energi, Gaya, dan Peta">
      ${dateFields("timeopen", opens, true)}${dateFields("timeclose", closes, closeEnabled)}
      <input type="submit" value="Simpan dan kembali ke kursus"></form>`,
  );
}

export function questionsPage(count = 15): string {
  const slots = Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    const name = `Soal ${String(slot).padStart(2, "0")}`;
    // Moodle's id is the slot's database id, not its number.
    return `<li class="activity multichoice qtype_multichoice slot" id="slot-${slot + 20}">
      <a title="Edit soal ${name}" href="${BASE}/question/bank/editquestion/question.php?returnurl=%2Fmod%2Fquiz%2Fedit.php%3Fcmid%3D3&amp;cmid=3&amp;id=${slot}">
        <span class="instancename"><span class="questionname">${name}</span> <span class="questiontext">…</span></span></a>
      <a href="${BASE}/question/bank/previewquestion/preview.php?id=${slot}&amp;cmid=3" title="Pratinjau soal">Pratinjau</a>
    </li>`;
  }).join("");
  return body(
    "page-mod-quiz-edit",
    `<div class="statusbar">Soal: ${count}</div>
    <label for="inputmaxgrade">Nilai maksimum</label><input id="inputmaxgrade" name="maxgrade" value="100,00">
    <ul class="section">${slots}</ul>`,
  );
}

/** A question's edit form; `grades` are the selected values of its answers' Nilai fields. */
export function editForm(grades: string[]): string {
  const fields = grades
    .map(
      (grade, index) =>
        `<select name="fraction[${index}]">${["0.0", "1.0", "0.5", "-0.5"]
          .map(
            (value) =>
              `<option value="${value}"${value === grade ? ' selected=""' : ""}>${value}</option>`,
          )
          .join("")}</select>`,
    )
    .join("");
  return `<body id="page-question-type-multichoice"><form>${fields}<select name="penalty"><option value="0.3333333" selected>33,33333%</option></select></form></body>`;
}

/** One page of the preview: its questions (slot → images) and Navigasi kuis for all `slots`. */
export function attemptPage(
  questions: Record<number, { text?: string; images?: string[] }>,
  slots = 15,
  current = 0,
): string {
  const nav = Array.from({ length: slots }, (_, index) => {
    const slot = index + 1;
    const page = slot - 1;
    return `<a class="qnbutton notyetanswered free btn${page === current ? " thispage" : ""}" id="quiznavbutton${slot}" title="Soal ${slot} - Belum dijawab" data-quiz-page="${page}" href="#"><span class="accesshide"> Soal </span> ${slot}</a>`;
  }).join("");
  const boxes = Object.entries(questions)
    .map(
      ([
        slot,
        question,
      ]) => `<div id="question-2-${slot}" class="que multichoice deferredfeedback notyetanswered">
      <div class="info"><h3 class="no">Soal <span class="qno">${slot}</span></h3>
        <a class="aabtn"><img class="questionflagimage" src="${BASE}/theme/flag.svg" alt="">Tandai soal</a></div>
      <div class="content"><div class="formulation clearfix">
        <div class="qtext"><p>${question.text ?? `Teks soal ${slot}`}</p><p>${(
          question.images ?? []
        )
          .map(
            (src, index) =>
              `<img src="${BASE}/pluginfile.php/13/question/questiontext/2/${slot}/${slot}/${src}" alt="Gambar (${index + 1})" width="240" height="170">`,
          )
          .join(" ")}</p></div>
        <fieldset class="ablock"><div class="answer"><div class="r0"><input type="radio" name="q2:${slot}_answer" value="0"><label>pilihan</label></div></div></fieldset>
      </div></div>
    </div>`,
    )
    .join("");
  return body(
    "page-mod-quiz-attempt",
    `<section class="block_quiz_navigation"><div class="qn_buttons">${nav}</div></section><form id="responseform">${boxes}</form>`,
  );
}

export function parse(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html>${html}</html>`, "text/html");
}
