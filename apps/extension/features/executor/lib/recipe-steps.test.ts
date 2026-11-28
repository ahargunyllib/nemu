import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";
import { describe, expect, test } from "vite-plus/test";

import { recipeItems, recipeOf, shortDate, stoppedDetail } from "./recipe-steps";

const STAGED: ExecutorStep[] = [
  { verb: "clickMenu", stage: "Menu Nilai", target: { role: "link", text: "Nilai" } },
  { verb: "selectOption", stage: "Pilih kelas", target: { label: "Kelas" }, option: "4B" },
  { verb: "selectOption", stage: "Pilih kelas", target: { label: "Mapel" }, option: "IPAS" },
  {
    verb: "setValue",
    stage: "Ketik nilai per murid",
    target: { row: "Ahmad", column: "Nilai" },
    value: "80",
  },
  {
    verb: "setValue",
    stage: "Ketik nilai per murid",
    target: { row: "Budi", column: "Nilai" },
    value: "70",
  },
  { verb: "point", stage: "Tekan Simpan", target: { text: "Simpan" }, sentence: "Tekan Simpan." },
];

describe("Catatan langkah as a recipe (F1·12)", () => {
  test("lists the plan's stages in order, once each, not who pressed what", () => {
    expect(recipeItems(STAGED)).toEqual([
      "Menu Nilai",
      "Pilih kelas",
      "Ketik nilai per murid",
      "Tekan Simpan",
    ]);
  });

  test("a step without a stage gets a plain line from its verb; a run of one kind shares it", () => {
    expect(
      recipeItems([
        { verb: "clickMenu", target: { role: "link", text: "Ujian" } },
        { verb: "selectOption", target: { label: "Kelas" }, option: "4A" },
        { verb: "selectOption", target: { label: "Surah" }, option: "An-Naba" },
        { verb: "setValue", target: { row: "Citra", column: "Skor" }, value: "90" },
        { verb: "setValue", target: { row: "Dodi", column: "Skor" }, value: "85" },
        { verb: "check", target: { label: "Hadir" }, checked: true },
        { verb: "scroll", target: { text: "Bawah" } },
        { verb: "point", target: { text: "Simpan" }, sentence: "Tekan Simpan." },
      ]),
    ).toEqual([
      "Buka Ujian",
      "Pilih Kelas, Surah",
      "Isi skor per baris",
      "Centang Hadir",
      "Tekan Simpan",
    ]);
  });

  test("is named after the job and dated from the run that saved it (F1·12b)", () => {
    const task: ExecutorTask = {
      kind: "f1-isi-nilai",
      title: "Isi nilai UTS Matematika 4B",
      recipe: { name: "Isi nilai kelas", from: "pengisian Matematika 4B" },
      steps: STAGED,
    };
    expect(recipeOf(task, new Date(2026, 11, 1))).toEqual({
      title: "Cara isi nilai kelas",
      subtitle: "Disimpan dari pengisian Matematika 4B, 1 Des 2026.",
      items: ["Menu Nilai", "Pilih kelas", "Ketik nilai per murid", "Tekan Simpan"],
    });
    // A task without a recipe name (a recording, the AI) is called after its title.
    const { recipe: _recipe, ...untitled } = task;
    expect(recipeOf(untitled, new Date(2026, 11, 1))).toMatchObject({
      title: "Cara isi nilai UTS Matematika 4B",
      subtitle: "Disimpan dari isi nilai UTS Matematika 4B, 1 Des 2026.",
    });
    expect(
      recipeOf({ ...untitled, source: "Kamus Kendala K-02" }, new Date(2026, 11, 1)).subtitle,
    ).toBe("Disimpan dari Kamus Kendala K-02, 1 Des 2026.");
    expect(shortDate(new Date(2026, 0, 15))).toBe("15 Jan 2026");
  });

  test("a stopped run says where it stopped, under the recipe", () => {
    const task: ExecutorTask = { kind: "x", title: "X", steps: STAGED };
    expect(stoppedDetail({ status: "stopped", index: 2, task })).toBe(
      "Berhenti di langkah 3 dari 6. Isian tetap ada.",
    );
    expect(stoppedDetail({ status: "done", index: 6, task })).toBeUndefined();
  });
});
