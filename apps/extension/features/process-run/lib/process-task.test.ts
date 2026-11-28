// @vitest-environment happy-dom
import { matchFieldLabels } from "@nemu/ai/school/bpmn/fields";
import type { BpmnPlan } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import {
  actionTarget,
  afterLine,
  canRun,
  nextProcessSteps,
  pagePath,
  processTask,
  readPageLabels,
} from "./process-task";

/**
 * F3 (#213): the plan of an uploaded BPMN becomes executor steps on whatever page the school's
 * AlurSekolah shows. These pages are shaped like the mock's Al-Quran › Tahfidz, but nothing in
 * the code under test knows tahfidz.
 */

const match = async (fields: Array<{ id: string; label: string }>, labels: string[]) =>
  matchFieldLabels(fields, labels);

const PLAN: BpmnPlan & { tasks: [BpmnPlan["tasks"][number]] } = {
  processId: "Process_X",
  processName: "Catat Hafalan Tahfidz",
  slots: {},
  path: [],
  activeTaskId: "Task_Catat",
  step: { kind: "done", taskId: null, sentence: "" },
  stepIndex: 0,
  stepCount: 4,
  steps: [
    {
      kind: "fill",
      taskId: "Task_Catat",
      fields: [{ fieldId: "kelas", label: "Kelas", value: "4A" }],
      sentence: "",
      because: null,
    },
    {
      kind: "fill",
      taskId: "Task_Catat",
      fields: [{ fieldId: "jenis", label: "Jenis catatan Tahfidz", value: "Setoran" }],
      sentence: "",
      because: null,
    },
    {
      kind: "fill",
      taskId: "Task_Catat",
      fields: [{ fieldId: "tanggal", label: "Tanggal setoran", value: "2026-12-01" }],
      sentence: "",
      because: null,
    },
    {
      kind: "rows",
      taskId: "Task_Catat",
      keyField: "murid",
      columns: [
        { fieldId: "surah", label: "Surah" },
        { fieldId: "skor", label: "Tajwid" },
      ],
      rows: [
        { name: "Citra Lestari", values: { surah: "'Abasa", skor: "87" } },
        { name: "Bagas Pratama", values: { surah: "An-Nazi'at" } as Record<string, string> },
      ],
      sentence: "",
    },
    {
      kind: "human",
      taskId: "Task_Catat",
      action: "Simpan setoran",
      sentence: "",
    },
    { kind: "done", taskId: "Task_Sistem", sentence: "" },
  ],
  overview: ["a", "b"],
  tasks: [
    {
      taskId: "Task_Catat",
      name: "Catat Setoran Kelas",
      page: "Al-Quran › Setoran baru",
      pageSource: "mapping",
      action: "Simpan setoran",
    },
  ],
  announcements: ["Sistem AlurSekolah: hitung nilai hafalan."],
};

const MENU = `<nav><a href="#/nilai">Nilai</a><a href="#/tahfidz">Al-Quran</a></nav>`;
const CLASS_PAGE = `${MENU}
  <h1>Al-Quran › Tahfidz</h1>
  <label for="k">Kelas</label><select id="k"><option value="">Pilih kelas</option><option>4A</option></select>
  <button>Setoran baru</button>`;
const FORM_PAGE = `${CLASS_PAGE}
  <label for="t">Tanggal</label><input type="date" id="t">
  <table><thead><tr><th>Murid</th><th>Surah</th><th>Tajwid</th></tr></thead><tbody>
    <tr><td>Bagas Pratama</td><td><select><option>An-Nazi'at</option></select></td><td><input type="number"></td></tr>
    <tr><td>Citra Lestari</td><td><select><option>'Abasa</option></select></td><td><input type="number"></td></tr>
  </tbody></table>
  <table><tr><th>Murid</th><th>Nilai</th></tr><tr><td>Citra Lestari</td><td>80</td></tr></table>
  <button>Simpan setoran</button>`;

describe("F3 process task (#213)", () => {
  test("the WS-04 page path is clicked in order, starting with its first menu item", () => {
    expect(pagePath("Al-Quran › Tahfidz > Setoran baru")).toEqual([
      "Al-Quran",
      "Tahfidz",
      "Setoran baru",
    ]);
    const { task, continuation } = processTask({
      plan: PLAN,
      task: PLAN.tasks[0],
      honorific: "Bu",
      source: "Proses Catat Hafalan Tahfidz",
    });
    expect(task.steps).toEqual([{ verb: "clickMenu", target: { text: "Al-Quran" } }]);
    expect(continuation).toMatchObject({
      segments: ["Setoran baru"],
      action: "Simpan setoran",
      sentence: "Silakan Ibu tekan Simpan setoran.",
    });
    expect(continuation.ringkasan).toContain("Citra Lestari: Surah 'Abasa, Tajwid 87");
  });

  test("no page for a task means only explaining", () => {
    expect(canRun(PLAN)).toBe(true);
    expect(canRun({ tasks: [{ ...PLAN.tasks[0], page: null, pageSource: null }] })).toBe(false);
  });

  test("on each page Nemu fills what that page shows before opening the next menu item", async () => {
    const { continuation } = processTask({
      plan: PLAN,
      task: PLAN.tasks[0],
      honorific: "Bu",
      source: "",
    });
    document.body.innerHTML = CLASS_PAGE;
    const first = await nextProcessSteps(document, continuation, match, 0);
    expect(first.steps).toEqual([
      { verb: "selectOption", target: { label: "Kelas", role: "combobox" }, option: "4A" },
      { verb: "clickMenu", target: { text: "Setoran baru" } },
    ]);
    // No "Jenis catatan" field on the page: the "Setoran baru" click is that choice.
    expect(first.continuation?.header.map((field) => field.fieldId)).toEqual(["tanggal"]);

    document.body.innerHTML = FORM_PAGE;
    const last = await nextProcessSteps(document, first.continuation!, match, 0);
    expect(last.continuation).toBeNull();
    expect(last.steps).toEqual([
      // "Tanggal setoran" in the BPMN is "Tanggal" on this page (F3-17).
      { verb: "setValue", target: { label: "Tanggal", role: "textbox" }, value: "2026-12-01" },
      {
        verb: "selectOption",
        target: { row: "Citra Lestari", column: "Surah", role: "combobox" },
        option: "'Abasa",
      },
      {
        verb: "setValue",
        target: { row: "Citra Lestari", column: "Tajwid", role: "textbox" },
        value: "87",
        rowName: "Citra Lestari",
      },
      {
        verb: "selectOption",
        target: { row: "Bagas Pratama", column: "Surah", role: "combobox" },
        option: "An-Nazi'at",
      },
      {
        verb: "point",
        target: { role: "button", text: "Simpan setoran" },
        sentence: "Silakan Ibu tekan Simpan setoran.",
        ringkasan: expect.stringContaining("Bagas Pratama: Surah An-Nazi'at"),
      },
    ]);
  });

  test("the form's own labels and the table's headers are read apart; Nemu's overlay is skipped", () => {
    document.body.innerHTML = `${FORM_PAGE}<nemu-overlay><input aria-label="Pertanyaan untuk Nemu"></nemu-overlay>`;
    expect(readPageLabels(document)).toEqual({
      fields: ["Kelas", "Tanggal"],
      columns: ["Murid", "Surah", "Tajwid", "Nilai"],
    });
  });

  test("a page whose button is named differently still ends on the one button only she presses", () => {
    document.body.innerHTML = `${MENU}<button>Batal</button><button>Simpan</button>`;
    expect(actionTarget(document, "Simpan setoran")).toEqual({ role: "button", text: "Simpan" });
  });
});

describe("what others do after the teacher's part (F3-18)", () => {
  test("one doer's tasks read as one line", () => {
    expect(
      afterLine([
        "Sistem AlurSekolah: hitung nilai dan huruf.",
        "Sistem AlurSekolah: tampilkan di aplikasi orang tua.",
      ]),
    ).toBe(
      "Sesudah itu, Sistem AlurSekolah: hitung nilai dan huruf, lalu tampilkan di aplikasi orang tua.",
    );
    expect(
      afterLine([
        "Kepala sekolah: persetujuan Kepala Sekolah.",
        "Admin: rekap Kehadiran oleh Admin.",
      ]),
    ).toBe(
      "Sesudah itu, Kepala sekolah: persetujuan Kepala Sekolah; Admin: rekap Kehadiran oleh Admin.",
    );
    expect(afterLine([])).toBeUndefined();
  });
});
