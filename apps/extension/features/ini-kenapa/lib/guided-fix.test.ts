// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";

import { guidedFixTask, menuNamedIn } from "./guided-fix";

afterEach(() => {
  document.body.innerHTML = "";
});

/** The mock Ruang GTK's menu (apps/mock-portals/ruang-gtk). */
const MENU = `<nav aria-label="Menu utama">
  <a href="#/beranda">Beranda</a>
  <a href="#/kinerja">Pengelolaan Kinerja</a>
  <a href="#/e-kinerja">E-Kinerja</a>
  <a href="#/data-saya">Data Saya</a>
</nav>`;

const K02 = {
  kind: "fix" as const,
  target: "Sinkro Ruang GTK",
  how: "Guru cukup membuka menu E-Kinerja dan menekan tombol Sinkro Ruang GTK, lalu mengirim ulang SKP dari Pengelolaan Kinerja",
  entryId: "K-02",
};

describe("guidedFixTask", () => {
  test("F2-3: on the error page, Nemu points at E-Kinerja first, then at Sinkro Ruang GTK", () => {
    document.body.innerHTML = `${MENU}<h1>Pengelolaan Kinerja 2026</h1>
      <div role="alert">Mohon coba lagi atau tekan tombol "Sinkro Ruang GTK" di E-Kinerja.</div>`;
    expect(guidedFixTask(document, K02)).toEqual({
      kind: "ini-kenapa",
      title: "Perbaiki sendiri: Sinkro Ruang GTK",
      source: "Kamus Kendala K-02",
      steps: [
        { verb: "clickMenu", target: { label: "E-Kinerja" } },
        { verb: "point", target: { label: "Sinkro Ruang GTK" }, sentence: "Klik Sinkro Ruang GTK." },
      ],
    });
  });

  test("when the button is already on the page, Nemu only points at it", () => {
    document.body.innerHTML = `${MENU}<h1>E-Kinerja</h1><button>Sinkro Ruang GTK</button>`;
    expect(guidedFixTask(document, K02).steps).toEqual([
      { verb: "point", target: { label: "Sinkro Ruang GTK" }, sentence: "Klik Sinkro Ruang GTK." },
    ]);
  });
});

describe("menuNamedIn", () => {
  test("takes the menu named after the target when none comes before it", () => {
    document.body.innerHTML = MENU;
    expect(menuNamedIn(document, "Tekan tombol Sinkro Ruang GTK di E-Kinerja", "Sinkro Ruang GTK")).toBe(
      "E-Kinerja",
    );
  });

  test("names no menu the sentence doesn't mention", () => {
    document.body.innerHTML = MENU;
    expect(menuNamedIn(document, "Guru cukup masuk kembali", "Masuk")).toBeNull();
  });
});
