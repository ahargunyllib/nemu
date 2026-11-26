// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";

import { readPageEmail, samePageEmail } from "./page-email-readers";

const MOCK = "https://nemu-alursekolah.ahargunyllib.dev/#/beranda";

/** The mock AlurSekolah's menu, as `apps/mock-alursekolah/public/index.html` renders it. */
function mockMenu(email: string | null) {
  document.body.innerHTML = `
    <nav id="nav" class="${email ? "" : "hidden"}">
      <div id="menu-akun"><b id="menu-nama">Siti Aminah, S.Pd.</b><span id="menu-email">${email ?? ""}</span></div>
    </nav>
    <main id="app"></main>`;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("readPageEmail", () => {
  test("reads the signed-in email from the mock AlurSekolah menu, locally too", () => {
    mockMenu("Siti.Aminah@sditnusantara.sch.id");
    expect(readPageEmail(MOCK, document)).toEqual({
      kind: "read",
      email: "siti.aminah@sditnusantara.sch.id",
    });
    expect(readPageEmail("http://localhost:3003/#/nilai", document)).toEqual({
      kind: "read",
      email: "siti.aminah@sditnusantara.sch.id",
    });
  });

  test("ID-04: a different account after switching, and none once signed out", () => {
    mockMenu("siti.aminah@sditnusantara.sch.id");
    const before = readPageEmail(MOCK, document);
    mockMenu("dewi.lestari@sditnusantara.sch.id");
    const after = readPageEmail(MOCK, document);
    expect(after).toEqual({ kind: "read", email: "dewi.lestari@sditnusantara.sch.id" });
    expect(samePageEmail(before, after)).toBe(false);

    mockMenu(null);
    expect(readPageEmail(MOCK, document)).toEqual({ kind: "read", email: null });
  });

  test("falls back to Profil when the menu shows no email", () => {
    document.body.innerHTML = `<nav id="nav"><span id="menu-email"></span></nav>
      <table><tr><th>Email</th><td id="profil-email">dewi.lestari@sditnusantara.sch.id</td></tr></table>`;
    expect(readPageEmail(MOCK, document)).toEqual({
      kind: "read",
      email: "dewi.lestari@sditnusantara.sch.id",
    });
  });

  test("the tenant placeholder reads an email from the header only", () => {
    document.body.innerHTML = `<header><span>Guru · siti.aminah@sditnusantara.sch.id</span></header>
      <main>Kontak sekolah: tu@sditnusantara.sch.id</main>`;
    expect(readPageEmail("https://sditnusantara.alursekolah.id/dashboard", document)).toEqual({
      kind: "read",
      email: "siti.aminah@sditnusantara.sch.id",
    });
  });

  test("sites without an AlurSekolah account are unreadable, not signed out", () => {
    document.body.innerHTML = `<header>operator@ruang-gtk.example</header>`;
    expect(readPageEmail("https://nemu-ruang-gtk.ahargunyllib.dev/", document)).toEqual({
      kind: "unreadable",
    });
  });
});
