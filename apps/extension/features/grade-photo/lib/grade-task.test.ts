import type { GradeEntry } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { addressFor, formAssessment, GRADE_TASK_KIND, gradeTask } from "./grade-task";

const ENTRIES: GradeEntry[] = [
  { studentId: "s-1", name: "Ahmad Fadli", value: 82, status: "value", remedial: false },
  { studentId: "s-4", name: "Bagas Saputra", value: 58, status: "value", remedial: true },
  { studentId: "s-21", name: "Putra Wijaya", value: null, status: "S", remedial: false },
];

const task = gradeTask({
  command: { className: "4B", subject: "Matematika", assessment: "UTS" },
  entries: ENTRIES,
  summarySentence: "3 nilai, 1 remedial, 1 kosong.",
  honorific: "Bu",
});

describe("the F1 fill task (cara 1)", () => {
  test("opens Isi nilai kelas through the menu and picks the class, subject and assessment", () => {
    expect(task.kind).toBe(GRADE_TASK_KIND);
    expect(task.steps.slice(0, 5)).toEqual([
      { verb: "clickMenu", target: { role: "link", text: "Nilai" } },
      { verb: "selectOption", target: { label: "Kelas" }, option: "4B" },
      { verb: "selectOption", target: { label: "Mata Pelajaran" }, option: "Matematika" },
      { verb: "selectOption", target: { label: "Jenis Penilaian" }, option: "UTS" },
      { verb: "clickMenu", target: { role: "button", text: "Tampilkan Siswa" } },
    ]);
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

  test("ends pointing at Simpan, which the teacher presses, with the numbers behind Lihat ringkasan", () => {
    const last = task.steps.at(-1);
    expect(last).toMatchObject({
      verb: "point",
      target: { role: "button", text: "Simpan" },
      sentence: "Silakan Ibu tekan Simpan.",
    });
    expect(last && "ringkasan" in last && last.ringkasan).toBe(
      "3 nilai, 1 remedial, 1 kosong. Ahmad Fadli 82, Bagas Saputra 58 (remedial), Putra Wijaya kosong (tidak hadir).",
    );
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
