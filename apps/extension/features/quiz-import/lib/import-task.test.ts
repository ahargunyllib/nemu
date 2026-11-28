// @vitest-environment happy-dom
import type { ExecutorStep } from "@nemu/contracts/executor";
import { describe, expect, test } from "vite-plus/test";

import {
  type ImportContinuation,
  type ImportIo,
  type ImportOutcome,
  nextImportSteps,
  QUIZ_IMPORT_KIND,
  quizImportTask,
} from "./import-task";
import type { ImportPlan } from "./plan";
import {
  coursePageHtml,
  importDone,
  importForm,
  importRefused,
  newQuizForm,
  questionBank,
  quizEdit,
  quizView,
  URLS,
} from "./test-pages";

const PLAN: ImportPlan = {
  courseId: 2,
  section: "IPAS",
  name: "Latihan IPAS Kelas 4A",
  opens: { date: "2026-12-07", time: "00:00" },
  closes: { date: "2026-12-10", time: "23:59" },
  xml: "<quiz></quiz>",
  fileName: "Latihan IPAS Kelas 4A.xml",
  count: 10,
};
const CMID = 9;

/** The browser for one run: the page shown now; `onDrop` stands in for Moodle's drop upload. */
function browserAt(
  html: string,
  url: string,
  onDrop: (io: Browser, file: File) => void = () => {},
) {
  const downloads: { fileName: string; xml: string }[] = [];
  const said: string[] = [];
  const io: Browser = {
    doc: document,
    url: () => current,
    sleep: async () => undefined,
    drop: (file) => onDrop(io, file),
    download: (fileName, xml) => downloads.push({ fileName, xml }),
    say: (sentence) => said.push(sentence),
    show(next, address) {
      const parsed = new DOMParser().parseFromString(next, "text/html");
      document.body.innerHTML = parsed.body.innerHTML;
      document.body.id = parsed.body.id;
      document.body.className = parsed.body.className;
      current = address;
    },
  };
  let current = url;
  io.show(html, url);
  return { io, downloads, said };
}
type Browser = ImportIo & { show(html: string, url: string): void };

const ALLOWED = new Set(["point", "setValue", "selectOption", "check", "clickMenu"]);

describe("F4-03 as one executor task (#210)", () => {
  test("a course page not in Mode Edit: Mode Edit first, then the section's Tambahkan konten › Kuis", async () => {
    const { io } = browserAt(coursePageHtml(false), URLS.course);
    const started = quizImportTask(io.doc, URLS.course, PLAN, "Bu")!;
    expect(started.task.kind).toBe(QUIZ_IMPORT_KIND);
    expect(started.task.steps).toEqual([
      { verb: "check", target: { role: "checkbox", label: "Mode Edit" }, checked: true },
    ]);
    io.show(coursePageHtml(true), URLS.course);
    const next = await nextImportSteps(io, started.continuation, () => {});
    expect(next.steps.map((step) => step.target)).toEqual([
      { role: "button", label: "Masukkan konten di bagian 'IPAS'" },
      { role: "button", text: "Aktivitas atau sumber daya" },
      { role: "tab", text: "Semua" },
      { role: "link", text: "Kuis" },
      { role: "button", text: "Tambahkan" },
    ]);
    // Off the course page (or another course) there is no task.
    expect(quizImportTask(io.doc, URLS.view(3), PLAN, "Bu")).toBeNull();
    expect(quizImportTask(io.doc, URLS.course, { ...PLAN, courseId: 5 }, "Bu")).toBeNull();
  });

  test("the quiz form: name, Waktu Pengerjaan opened, both times by group as Moodle names them; she saves", async () => {
    const { io } = browserAt(coursePageHtml(true), URLS.course);
    const started = quizImportTask(io.doc, URLS.course, PLAN, "Bu")!;
    io.show(newQuizForm(false), URLS.form);
    const { steps, continuation } = await nextImportSteps(io, started.continuation, () => {});
    expect(steps.slice(0, 2)).toEqual([
      {
        verb: "setValue",
        target: { role: "textbox", label: "Nama" },
        value: "Latihan IPAS Kelas 4A",
      },
      { verb: "clickMenu", target: { role: "button", text: "Waktu Pengerjaan" } },
    ]);
    const times = steps
      .filter(
        (step): step is Extract<ExecutorStep, { verb: "selectOption" }> =>
          step.verb === "selectOption",
      )
      .map((step) => `${step.target.group} ${step.target.label}=${step.option}`);
    expect(times).toEqual([
      "Kuis dimulai Hari=7",
      "Kuis dimulai Bulan=December",
      "Kuis dimulai Tahun=2026",
      "Kuis dimulai Jam=00",
      "Kuis dimulai Menit=00",
      "Tutup kuis Hari=10",
      "Tutup kuis Bulan=December",
      "Tutup kuis Tahun=2026",
      "Tutup kuis Jam=23",
      "Tutup kuis Menit=59",
    ]);
    expect(steps.filter((step) => step.verb === "check").map((step) => step.target.group)).toEqual([
      "Kuis dimulai",
      "Tutup kuis",
    ]);
    expect(steps.at(-1)).toMatchObject({
      verb: "point",
      target: { role: "button", text: "Simpan dan tampilkan" },
      sentence:
        "Tekan Simpan dan tampilkan, Bu. Kuis dibuka 7 Desember pukul 00.00, ditutup 10 Desember pukul 23.59.",
    });
    expect(continuation?.phase).toBe("saved");
    // Waktu Pengerjaan already open: it isn't clicked shut.
    io.show(newQuizForm(true), URLS.form);
    const again = await nextImportSteps(io, started.continuation, () => {});
    expect(again.steps.some((step) => step.verb === "clickMenu")).toBe(false);
  });

  test("the whole walk with the drop taken: only allowed verbs, and every form submit is hers", async () => {
    const outcomes: ImportOutcome[] = [];
    const { io, said, downloads } = browserAt(coursePageHtml(true), URLS.course, (browser, file) =>
      browser.show(importForm(CMID, file.name, true), URLS.import(CMID)),
    );
    const started = quizImportTask(io.doc, URLS.course, PLAN, "Bu")!;
    const all: ExecutorStep[] = [...started.task.steps];
    let continuation: ImportContinuation | null = started.continuation;
    const pages: [string, string][] = [
      [newQuizForm(false), URLS.form],
      [quizView(CMID), URLS.view(CMID)],
      [questionBank(CMID), URLS.bank(CMID)],
      [importForm(CMID, null), URLS.import(CMID)],
      [importForm(CMID, null, true), URLS.import(CMID)],
      [importDone(CMID, 10), URLS.import(CMID)],
      [quizEdit(CMID, 0), URLS.edit(CMID)],
      [quizEdit(CMID, 10), URLS.edit(CMID)],
    ];
    for (const [html, url] of pages) {
      io.show(html, url);
      const next = await nextImportSteps(io, continuation!, (outcome) => outcomes.push(outcome));
      all.push(...next.steps);
      continuation = next.continuation;
    }
    expect(continuation).toBeNull();
    expect(outcomes).toEqual([{ status: "added", cmid: CMID, listed: 10, dropped: true }]);
    expect(all.every((step) => ALLOWED.has(step.verb))).toBe(true);
    expect(all.filter((step) => step.verb === "point").map((step) => step.target.text)).toEqual([
      "Simpan dan tampilkan",
      "Impor",
      "Tambahkan soal terpilih pada kuis",
    ]);
    expect(
      all
        .filter((step) => step.verb === "clickMenu")
        .map((step) => step.target.text ?? step.target.label),
    ).toEqual([
      "Masukkan konten di bagian 'IPAS'",
      "Aktivitas atau sumber daya",
      "Semua",
      "Kuis",
      "Tambahkan",
      "Waktu Pengerjaan",
      "Bank soal",
      "Soal-soal",
      "Impor",
      "Umum",
      "Soal",
      "Tambah",
      "dari bank soal",
    ]);
    // Moodle XML, and the questions go into the quiz's own bank, not a category from the file.
    expect(all).toContainEqual({
      verb: "check",
      target: { role: "radio", label: "Format XML Moodle" },
      checked: true,
    });
    expect(all).toContainEqual({
      verb: "check",
      target: { role: "checkbox", label: "Dapatkan kategori dari berkas" },
      checked: false,
    });
    expect(said).toEqual(["Nemu menaruh berkas Latihan IPAS Kelas 4A.xml di sini."]);
    expect(downloads).toEqual([]);
  });

  test("Moodle doesn't take the drop: the XML goes to Unduhan and Nemu points at Pilih berkas", async () => {
    const outcomes: ImportOutcome[] = [];
    const { io, downloads } = browserAt(importForm(CMID, null, true), URLS.import(CMID));
    const drop: ImportContinuation = {
      phase: "drop",
      plan: PLAN,
      honorific: "Bu",
      cmid: CMID,
      dropped: null,
    };
    const fallback = await nextImportSteps(io, drop, () => {});
    expect(downloads).toEqual([{ fileName: PLAN.fileName, xml: PLAN.xml }]);
    expect(fallback.steps).toEqual([
      {
        verb: "point",
        target: { role: "button", text: "Pilih berkas ..." },
        sentence: "Pilih berkas Latihan IPAS Kelas 4A.xml, Bu. Nemu sudah menyimpannya di Unduhan.",
      },
    ]);
    // She picks it in Moodle's own dialog; then Nemu points at Impor.
    io.show(importForm(CMID, PLAN.fileName, true), URLS.import(CMID));
    const picked = await nextImportSteps(io, fallback.continuation!, () => {});
    expect(picked.steps[0]).toMatchObject({ verb: "point", target: { text: "Impor" } });
    io.show(importDone(CMID, 10), URLS.import(CMID));
    const imported = await nextImportSteps(io, picked.continuation!, () => {});
    io.show(quizEdit(CMID, 10), URLS.edit(CMID));
    const questions = await nextImportSteps(io, imported.continuation!, () => {});
    await nextImportSteps(io, questions.continuation!, (outcome) => outcomes.push(outcome));
    expect(outcomes).toEqual([{ status: "added", cmid: CMID, listed: 10, dropped: false }]);
  });

  test("Moodle refuses the file: the task ends with Moodle's own words, nothing more is done", async () => {
    const outcomes: ImportOutcome[] = [];
    const { io } = browserAt(importRefused(CMID), URLS.import(CMID));
    const imported: ImportContinuation = {
      phase: "imported",
      plan: PLAN,
      honorific: "Bu",
      cmid: CMID,
      dropped: true,
    };
    expect(await nextImportSteps(io, imported, (outcome) => outcomes.push(outcome))).toEqual({
      steps: [],
      continuation: null,
    });
    expect(outcomes).toEqual([{ status: "error", message: "Galat saat mengurai berkas XML." }]);
  });
});
