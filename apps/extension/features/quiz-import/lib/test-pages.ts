/**
 * Cut-down Moodle 5.3 pages for F4-03's tests (#210): only the markup the readers and the step
 * source look at, with the site's Indonesian labels.
 */

export const MOODLE = "https://moodle.test";

const page = (body: { id?: string; className: string }, main: string) =>
  `<html><head></head><body id="${body.id ?? ""}" class="${body.className}">${main}</body></html>`;

export function coursePageHtml(editing: boolean): string {
  return page(
    {
      id: "page-course-view-topics",
      className: `path-course-view course-2${editing ? " editing" : ""}`,
    },
    `<nav><ol class="breadcrumb"><li class="breadcrumb-item"><a href="${MOODLE}/course/view.php?id=2" title="Kelas 4A (uji)">4A-UJI</a></li></ol></nav>
     <div class="page-header-headings"><h1>Kelas 4A (uji)</h1></div>
     <ul><li class="section" data-sectionname="Umum"></li><li class="section" data-sectionname="IPAS"></li>
     <li class="section" data-sectionname="Bahasa Inggris"></li></ul>`,
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateGroup(field: string, legend: string): string {
  const options = (values: [string, string][]) =>
    values.map(([text, value]) => `<option value="${value}">${text}</option>`).join("");
  const range = (from: number, to: number, pad = false) =>
    Array.from({ length: to - from + 1 }, (_, i) => {
      const n = from + i;
      return [pad ? String(n).padStart(2, "0") : String(n), String(n)] as [string, string];
    });
  return `<fieldset id="id_${field}"><legend class="visually-hidden">${legend}</legend>
    <label><input type="checkbox" id="id_${field}_enabled"> Aktifkan</label>
    <label for="id_${field}_day">Hari</label><select id="id_${field}_day">${options(range(1, 31))}</select>
    <label for="id_${field}_month">Bulan</label><select id="id_${field}_month">${options(MONTHS.map((name, i) => [name, String(i + 1)]))}</select>
    <label for="id_${field}_year">Tahun</label><select id="id_${field}_year">${options(range(2025, 2027))}</select>
    <label for="id_${field}_hour">Jam</label><select id="id_${field}_hour">${options(range(0, 23, true))}</select>
    <label for="id_${field}_minute">Menit</label><select id="id_${field}_minute">${options(range(0, 59, true))}</select>
  </fieldset>`;
}

export function newQuizForm(timingOpen: boolean): string {
  return page(
    { id: "page-mod-quiz-mod", className: "path-mod-quiz course-2" },
    `<form><label for="id_name">Nama</label><input type="text" id="id_name">
     <a data-bs-toggle="collapse" href="#id_timingcontainer" role="button" aria-expanded="${timingOpen}">Waktu Pengerjaan</a>
     <div id="id_timingcontainer" class="collapse${timingOpen ? " show" : ""}">
       ${dateGroup("timeopen", "Kuis dimulai")}${dateGroup("timeclose", "Tutup kuis")}
     </div>
     <input type="submit" value="Simpan dan kembali ke kursus"><input type="submit" value="Simpan dan tampilkan"></form>`,
  );
}

export function quizView(cmid: number): string {
  return page(
    { id: "page-mod-quiz-view", className: `path-mod-quiz cmid-${cmid}` },
    `<nav class="secondary-navigation"><a href="${MOODLE}/mod/quiz/view.php?id=${cmid}">Kuis</a>
     <a href="${MOODLE}/mod/quiz/edit.php?cmid=${cmid}">Soal</a><a href="${MOODLE}/question/edit.php?cmid=${cmid}">Bank soal</a></nav>`,
  );
}

export function questionBank(cmid: number): string {
  return page(
    { id: "page-question-edit", className: `path-question cmid-${cmid}` },
    `<div id="tertiary-navigation"><div role="combobox" aria-labelledby="l">Soal-soal</div><span id="l">Navigasi tersier bank soal</span>
     <ul role="listbox"><li role="option">Soal-soal</li><li role="option">Impor</li></ul></div>`,
  );
}

export function importForm(cmid: number, picked: string | null, generalOpen = false): string {
  return page(
    { id: "page-question-bank-importquestions-import", className: `path-question cmid-${cmid}` },
    `<div id="region-main"><form>
     <label><input type="radio" name="format" id="id_format_gift"> Format GIFT</label>
     <label><input type="radio" name="format" id="id_format_xml"> Format XML Moodle</label>
     <a data-bs-toggle="collapse" href="#id_general" role="button">Umum</a>
     <div id="id_general" class="collapse${generalOpen ? " show" : ""}">
       <label><input type="checkbox" id="id_catfromfile" checked> Dapatkan kategori dari berkas</label></div>
     <input type="button" value="Pilih berkas ...">
     <div class="filepicker-filelist"><div class="filepicker-filename">${
       picked
         ? `<a href="#">${picked}</a>`
         : `<div class="dndupload-message">Anda dapat seret dan lepas berkas di sini</div>`
     }</div></div>
     <input type="submit" value="Impor"></form></div>`,
  );
}

export function importDone(cmid: number, count: number): string {
  return page(
    { id: "page-question-bank-importquestions-import", className: `path-question cmid-${cmid}` },
    `<div id="region-main"><p>Menguraikan kalimat soal dari berkas impor.</p><p>Mengimpor ${count} soal dari berkas</p>
     <form action="${MOODLE}/question/edit.php"><input type="submit" value="Lanjutkan"></form></div>`,
  );
}

export function importRefused(cmid: number): string {
  return page(
    { id: "page-question-bank-importquestions-import", className: `path-question cmid-${cmid}` },
    `<div id="region-main"><div class="alert alert-danger">Galat saat mengurai berkas XML.</div>
     <input type="radio" id="id_format_xml"></div>`,
  );
}

export function quizEdit(cmid: number, slots: number): string {
  return page(
    { id: "page-mod-quiz-edit", className: `path-mod-quiz cmid-${cmid}` },
    `<ul>${Array.from({ length: slots }, (_, i) => `<li class="slot" id="slot-${i + 30}"></li>`).join("")}</ul>`,
  );
}

export const URLS = {
  course: `${MOODLE}/course/view.php?id=2`,
  form: `${MOODLE}/course/modedit.php?add=quiz&course=2&sectionid=2`,
  view: (cmid: number) => `${MOODLE}/mod/quiz/view.php?id=${cmid}`,
  bank: (cmid: number) => `${MOODLE}/question/edit.php?cmid=${cmid}`,
  import: (cmid: number) => `${MOODLE}/question/bank/importquestions/import.php?cmid=${cmid}`,
  edit: (cmid: number) => `${MOODLE}/mod/quiz/edit.php?cmid=${cmid}`,
};
