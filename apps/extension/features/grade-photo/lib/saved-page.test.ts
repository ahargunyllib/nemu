// @vitest-environment happy-dom
import type { GradeEntry } from "@nemu/contracts/school";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { cropRect } from "./crop";
import { gradesOnPage, isSavedMessage, watchForSave } from "./saved-page";

beforeEach(() => {
  document.body.innerHTML = `
    <table id="tabel-nilai">
      <thead><tr><th>No</th><th>Nama Siswa</th><th>Nilai</th><th>Catatan</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Ahmad Fadli</td><td><input type="number" value="82"></td><td><input type="text"></td></tr>
        <tr><td>2</td><td>Putra Wijaya</td><td><input type="number" value=""></td><td><input type="text" value="tidak hadir"></td></tr>
      </tbody>
    </table>
    <div id="hasil"></div>`;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("after Simpan (F1-10)", () => {
  test("recognises the page's saved message, not a failure or a question", () => {
    expect(isSavedMessage("Nilai tersimpan. 31 nilai Matematika UTS kelas 4B.")).toBe(true);
    expect(isSavedMessage("Data berhasil disimpan")).toBe(true);
    expect(isSavedMessage("Nilai belum tersimpan")).toBe(false);
    expect(isSavedMessage("Gagal menyimpan, nilai tidak tersimpan")).toBe(false);
    expect(isSavedMessage("Simpan nilai untuk semua siswa?")).toBe(false);
  });

  test("waits for a new saved message; one already on the page before Simpan doesn't count", async () => {
    document.querySelector("#hasil")!.innerHTML = `<div role="status">Nilai tersimpan. Lama.</div>`;
    const onSaved = vi.fn();
    const stop = watchForSave(document, onSaved);
    await flush();
    expect(onSaved).not.toHaveBeenCalled();
    document.querySelector("#hasil")!.innerHTML =
      `<div role="status">Nilai tersimpan. 31 nilai.</div>`;
    await flush();
    expect(onSaved).toHaveBeenCalledOnce();
    stop();
  });

  test("after a page load the message already there counts", async () => {
    document.querySelector("#hasil")!.innerHTML = `<div class="alert">Data berhasil disimpan</div>`;
    const onSaved = vi.fn();
    watchForSave(document, onSaved, { acceptPresent: true });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  test("reads each student's saved grade from the table by row and the Nilai column", () => {
    const entries = [
      { name: "Ahmad Fadli" },
      { name: "Putra Wijaya" },
      { name: "Tidak Ada" },
    ] as GradeEntry[];
    expect(gradesOnPage(document, entries)).toEqual([
      { name: "Ahmad Fadli", value: "82" },
      { name: "Putra Wijaya", value: "" },
    ]);
  });
});

describe("W5 crop", () => {
  test("takes the cell's box with a little of its line around it, enlarged, inside the photo", () => {
    const cell = cropRect([600, 150, 700, 170], 1000, 2000)!;
    expect(cell).toMatchObject({ left: 540, width: 220 });
    // A 20-unit line is too thin to read, so the crop grows to at most 3.2 : 1 around it.
    expect(cell.width / cell.height).toBeCloseTo(3.2);
    expect(cell.top + cell.height / 2).toBeCloseTo(320);
    const name = cropRect([0, 150, 595, 170], 1000, 2000)!;
    expect(name.width / name.height).toBeCloseTo(3.2);
    expect(cropRect([0, 0, 50, 20], 1000, 1000)).toMatchObject({ left: 0, top: 0 });
    expect(cropRect([1000, 1000, 1000, 1000], 1000, 1000)).toBeNull();
  });
});
