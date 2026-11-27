// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vite-plus/test";

import { findTarget } from "./find-target";

beforeEach(() => {
  document.body.innerHTML = `
    <nav><a href="#/nilai">Nilai</a><a href="#/rekap">Rekap Nilai</a></nav>
    <label for="kelas">Kelas</label><select id="kelas"><option>4A</option><option>4B</option></select>
    <label for="sandi">Kata sandi</label><input type="password" id="sandi">
    <table>
      <thead><tr><th>Nama Siswa</th><th>Nilai</th><th>Catatan</th></tr></thead>
      <tbody>
        <tr><td>Budi Santoso</td><td><input type="number"></td><td><input type="text"></td></tr>
        <tr><td>Citra Ayu Lestari</td><td><input type="number" aria-label="Nilai Citra Ayu Lestari"></td><td><input type="text"></td></tr>
      </tbody>
    </table>
    <button>Simpan</button>
    <button hidden>Hapus</button>
    <dialog><button>Ya, simpan</button></dialog>`;
});

describe("findTarget (F0-06)", () => {
  test("finds a field by its label, a link by its exact text and a field by its aria-label", () => {
    expect(findTarget(document, { label: "Kelas" })).toMatchObject({
      status: "found",
      element: document.getElementById("kelas"),
    });
    // "Nilai", not "Rekap Nilai": an exact name wins over one that only contains it.
    expect(findTarget(document, { role: "link", text: "Nilai" })).toMatchObject({
      status: "found",
      element: document.querySelector("a[href='#/nilai']"),
    });
    expect(findTarget(document, { label: "Nilai Citra Ayu Lestari" })).toMatchObject({
      status: "found",
      name: "Nilai Citra Ayu Lestari",
    });
  });

  test("finds the field in a student's row under a column header, without any label", () => {
    const lookup = findTarget(document, { row: "Budi Santoso", column: "Nilai" });
    expect(lookup.status).toBe("found");
    if (lookup.status === "found")
      expect(lookup.element).toBe(document.querySelector("tbody tr input[type=number]"));
  });

  test("reports a missing target, and an ambiguous one, instead of guessing", () => {
    expect(findTarget(document, { label: "Mata Pelajaran" })).toEqual({ status: "missing" });
    document.body.insertAdjacentHTML("beforeend", "<a href='#/nilai-2'>Nilai</a>");
    expect(findTarget(document, { role: "link", text: "Nilai" })).toEqual({
      status: "ambiguous",
      count: 2,
    });
  });

  test("never targets a password field or a hidden control", () => {
    expect(findTarget(document, { label: "Kata sandi" })).toEqual({ status: "missing" });
    expect(findTarget(document, { text: "Hapus" })).toEqual({ status: "missing" });
    expect(findTarget(document, { text: "Ya, simpan" })).toEqual({ status: "missing" });
  });

  test("a label that repeats is found in its group: Moodle's Hari under Kuis dimulai or Tutup kuis", () => {
    document.body.innerHTML = `
      <fieldset id="open"><legend class="visually-hidden">Kuis dimulai</legend>
        <label><input type="checkbox" id="open-on"> Aktifkan</label>
        <label for="open-day">Hari</label><select id="open-day"><option>30</option></select>
      </fieldset>
      <fieldset id="close"><legend>Tutup kuis</legend>
        <label><input type="checkbox" id="close-on"> Aktifkan</label>
        <label for="close-day">Hari</label><select id="close-day"><option>3</option></select>
      </fieldset>`;
    expect(findTarget(document, { label: "Hari" })).toEqual({ status: "ambiguous", count: 2 });
    expect(findTarget(document, { label: "Hari", group: "Tutup kuis" })).toMatchObject({
      status: "found",
      element: document.getElementById("close-day"),
      name: "Hari (Tutup kuis)",
    });
    expect(findTarget(document, { label: "Aktifkan", group: "Kuis dimulai" })).toMatchObject({
      status: "found",
      element: document.getElementById("open-on"),
    });
    expect(findTarget(document, { label: "Hari", group: "Batas waktu" })).toEqual({
      status: "missing",
    });
  });
});
