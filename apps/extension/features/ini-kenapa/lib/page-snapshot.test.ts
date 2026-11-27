// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";

import { readPageSnapshot } from "./page-snapshot";

afterEach(() => {
  document.body.innerHTML = "";
});

const URL_NILAI = "https://nemu-alursekolah.ahargunyllib.dev/#/nilai";

describe("readPageSnapshot", () => {
  test("reads the title, the alert, headings and each field with the value it shows", () => {
    document.title = "AlurSekolah (tiruan)";
    document.body.innerHTML = `<h1>Isi nilai kelas</h1>
      <label for="kelas">Kelas</label>
      <select id="kelas"><option>4B</option><option selected>4A</option></select>
      <label for="mapel">Mata pelajaran</label>
      <select id="mapel"><option selected>IPAS</option></select>
      <label><input type="checkbox" checked> Tampilkan remedial</label>
      <button>Tampilkan Siswa</button>
      <div role="alert"><b>Tidak dapat menampilkan siswa</b><br>
        Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.</div>`;
    const snapshot = readPageSnapshot(document, URL_NILAI);
    expect(snapshot).toMatchObject({
      title: "AlurSekolah (tiruan)",
      url: URL_NILAI,
      headings: ["Isi nilai kelas"],
      fields: [
        { label: "Kelas", value: "4A" },
        { label: "Mata pelajaran", value: "IPAS" },
        { label: "Tampilkan remedial", value: "dicentang" },
      ],
      screenshotBase64: null,
    });
    expect(snapshot?.alerts).toHaveLength(1);
    expect(snapshot?.alerts[0]).toContain("Anda belum ditugaskan mengampu IPAS di kelas 4A");
  });

  test("reads a toast and an error message once, even when they nest", () => {
    document.body.innerHTML = `<div role="status" aria-live="polite">Nilai tersimpan</div>
      <div class="alert"><p class="error" role="alert">Nilai harus berupa angka 0 sampai 100</p></div>`;
    expect(readPageSnapshot(document, URL_NILAI)?.alerts).toEqual([
      "Nilai tersimpan",
      "Nilai harus berupa angka 0 sampai 100",
    ]);
  });

  test("reads nothing at all while a password field is on screen", () => {
    document.body.innerHTML = `<h1>Masuk</h1><label>Kata sandi <input type="password"></label>
      <div role="alert">Sesi Anda telah berakhir</div>`;
    expect(readPageSnapshot(document, URL_NILAI)).toBeNull();
  });

  test("a hidden password field (a signed-in page keeps its sign-in form) doesn't block", () => {
    document.body.innerHTML = `<form hidden><input type="password"></form><h1>Rekap Nilai</h1>`;
    expect(readPageSnapshot(document, URL_NILAI)?.headings).toEqual(["Rekap Nilai"]);
  });
});
