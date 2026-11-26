// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vite-plus/test";

import { readPageSnapshot } from "./page-snapshot";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("readPageSnapshot", () => {
  test("keeps the page's text lines but never an input's value", () => {
    document.title = "AlurSekolah (tiruan)";
    document.body.innerHTML = `<h1>Isi nilai kelas</h1>
      <p>Anda belum ditugaskan mengampu IPAS di kelas 4A</p>
      <input id="nilai" value="88">`;
    const snapshot = readPageSnapshot(
      document,
      "https://nemu-alursekolah.ahargunyllib.dev/#/nilai",
    );
    expect(snapshot).toMatchObject({ title: "AlurSekolah (tiruan)", blocked: false });
    expect(snapshot.texts.join("\n")).toContain("Anda belum ditugaskan mengampu IPAS di kelas 4A");
    expect(snapshot.texts.join("\n")).not.toContain("88");
  });

  test("reads nothing while a password field is on the page", () => {
    document.body.innerHTML = `<h1>Masuk</h1><input type="password">`;
    expect(readPageSnapshot(document, "https://nemu-alursekolah.ahargunyllib.dev/")).toMatchObject({
      texts: [],
      blocked: true,
      blockedReason: "password_field",
    });
  });
});
