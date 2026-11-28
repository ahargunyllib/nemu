import type { GradeEntry } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { addressFor, formAssessment, GRADE_TASK_KIND, gradeSummary, gradeTask } from "./grade-task";

const ENTRIES: GradeEntry[] = [
  { studentId: "s-1", name: "Ahmad Fadli", value: 82, status: "value", remedial: false },
  { studentId: "s-4", name: "Bagas Saputra", value: 58, status: "value", remedial: true },
  { studentId: "s-21", name: "Putra Wijaya", value: null, status: "S", remedial: false },
];

const task = gradeTask({
  command: { className: "4B", subject: "Matematika", assessment: "UTS" },
  entries: ENTRIES,
  kkm: 75,
  honorific: "Bu",
});

describe("the F1 fill task (cara 1)", () => {
  test("opens Isi nilai kelas through the menu and picks the class, subject and assessment", () => {
    expect(task.kind).toBe(GRADE_TASK_KIND);
    expect(task.steps.slice(0, 5)).toMatchObject([
      { verb: "clickMenu", target: { role: "link", text: "Nilai" } },
      { verb: "selectOption", target: { label: "Kelas" }, option: "4B" },
      { verb: "selectOption", target: { label: "Mata Pelajaran" }, option: "Matematika" },
      { verb: "selectOption", target: { label: "Jenis Penilaian" }, option: "UTS" },
      { verb: "clickMenu", target: { role: "button", text: "Tampilkan Siswa" } },
    ]);
  });

  test("says each navigation step in its own words, as Langkah 1 and 2 of 3 (F1·05a–06b)", () => {
    expect(task.steps[0]).toMatchObject({
      approach: { sentence: "Saya buka menu Nilai, Bu.", detail: "Ibu lihat saja dulu." },
      sentence: "Ini menu Nilai.",
      detail: "Saya klik, Bu.",
      stage: { n: 1, of: 3 },
    });
    expect(task.steps.slice(1, 4).map((step) => "stage" in step && step.stage)).toEqual([
      { n: 2, of: 3 },
      { n: 2, of: 3 },
      { n: 2, of: 3 },
    ]);
    // The class, subject and assessment come from the task, not the design's example.
    const other = gradeTask({
      command: { className: "5A", subject: "IPAS", assessment: "UH 2" },
      entries: ENTRIES,
      kkm: 75,
      honorific: "Pak",
    });
    expect(other.steps[0]).toMatchObject({
      approach: { sentence: "Saya buka menu Nilai, Pak.", detail: "Bapak lihat saja dulu." },
      detail: "Saya klik, Pak.",
    });
    expect(other.steps[4]).toMatchObject({
      sentence: "Ini Isi nilai kelas 5A.",
      detail: "Kelas 5A, IPAS, Harian sudah saya pilih.",
      stage: { n: 2, of: 3 },
    });
    // The fill counts students on its heading instead of a stage.
    expect(task.steps.slice(5).some((step) => "stage" in step)).toBe(false);
  });

  test("fills each Nilai by the student's row; below KKM gets remedial, S stays blank and tidak hadir", () => {
    expect(task.steps.slice(5, -1)).toEqual([
      {
        verb: "setValue",
        target: { row: "Ahmad Fadli", column: "Nilai", role: "textbox" },
        value: "82",
        rowName: "Ahmad Fadli",
      },
      {
        verb: "setValue",
        target: { row: "Bagas Saputra", column: "Nilai", role: "textbox" },
        value: "58",
        rowName: "Bagas Saputra",
      },
      {
        verb: "setValue",
        target: { row: "Bagas Saputra", column: "Catatan", role: "textbox" },
        value: "remedial",
      },
      {
        verb: "setValue",
        target: { row: "Putra Wijaya", column: "Nilai", role: "textbox" },
        value: "",
        rowName: "Putra Wijaya",
      },
      {
        verb: "setValue",
        target: { row: "Putra Wijaya", column: "Catatan", role: "textbox" },
        value: "tidak hadir",
      },
    ]);
  });

  test("ends at Simpan, the teacher's turn, not yet saved, with the counts behind Lihat ringkasan (F1·11, 11a)", () => {
    expect(task.steps.at(-1)).toEqual({
      verb: "point",
      target: { role: "button", text: "Simpan" },
      sentence: "Silakan Ibu tekan Simpan.",
      heading: "Giliran Ibu",
      chip: "Belum tersimpan",
      ringkasanCard: {
        title: "2 dari 3 terisi, belum tersimpan.",
        itemsLabel: "Ringkasan · Matematika 4B, UTS",
        items: [
          "Terisi: 2 murid",
          "Dikosongkan: 1 murid (Putra, sakit)",
          "Di bawah KKM 75: 1 murid, diberi catatan remedial",
        ],
      },
    });
  });

  test("Ringkasan leaves out what doesn't apply and names who is blank and why", () => {
    const all = gradeSummary({
      command: { className: "4B", subject: "Matematika", assessment: "UTS" },
      entries: ENTRIES.slice(0, 1),
      kkm: 70,
    });
    expect(all.items).toEqual(["Terisi: 1 murid"]);
    const absent = gradeSummary({
      command: { className: "5A", subject: "IPAS", assessment: "UH 2" },
      entries: [
        ...ENTRIES,
        { studentId: "s-22", name: "Putra Pratama", value: null, status: "I", remedial: false },
      ],
      kkm: 70,
    });
    expect(absent.itemsLabel).toBe("Ringkasan · IPAS 5A, UH 2");
    // Two Putras: the full names tell them apart.
    expect(absent.items[1]).toBe("Dikosongkan: 2 murid (Putra Wijaya, sakit; Putra Pratama, izin)");
    expect(absent.items[2]).toBe("Di bawah KKM 70: 1 murid, diberi catatan remedial");
  });

  test("names the assessment as Jenis Penilaian lists it, and addresses the teacher in full", () => {
    expect(formAssessment("UTS")).toBe("UTS");
    expect(formAssessment("UAS")).toBe("UAS");
    expect(formAssessment("UH 2")).toBe("Harian");
    expect(formAssessment("Tugas 1")).toBe("Harian");
    expect(addressFor("Bu")).toBe("Ibu");
    expect(addressFor("Pak")).toBe("Bapak");
    expect(addressFor("")).toBe("Anda");
  });
});
