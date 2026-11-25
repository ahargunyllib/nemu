import assert from "node:assert/strict";
import test from "node:test";

import { cropRect } from "./electron.js";
import { createScreenReader, type AccessibleText, type ScreenPlatform } from "./reader.js";
import { parseUiaReply } from "./windows-uia.js";

const ERROR_PAGE: AccessibleText = {
  url: "https://ruang.gtk.example/kinerja",
  texts: ["Data Perencanaan (SKP) belum bisa diajukan karena RHK atasan belum tersedia."],
  elements: [
    { name: "Ajukan", controlType: "Button", rect: { x: 10, y: 20, width: 80, height: 30 } },
  ],
  hasPasswordField: false,
};

function platform(overrides: Partial<ScreenPlatform> = {}): ScreenPlatform & { captures: number } {
  const base = {
    captures: 0,
    async foregroundWindow() {
      return {
        title: "Ruang GTK - Google Chrome",
        bounds: { x: 0, y: 0, width: 1366, height: 768 },
        processName: "chrome.exe",
      };
    },
    async capture() {
      base.captures += 1;
      return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    },
    async accessibleText() {
      return {
        url: null,
        texts: [
          "Data Perencanaan (SKP) belum bisa diajukan karena RHK atasan belum tersedia.",
          "Pengelolaan Kinerja",
        ],
        elements: [],
        hasPasswordField: false,
      };
    },
    async pageText() {
      return ERROR_PAGE;
    },
    ...overrides,
  };
  return base;
}

test("reads page text first, merges UIA text without duplicates, and attaches the window screenshot", async () => {
  const snapshot = await createScreenReader(platform()).readActiveWindow();
  assert.equal(snapshot.blocked, false);
  assert.equal(snapshot.url, "https://ruang.gtk.example/kinerja");
  assert.deepEqual(snapshot.texts, [
    "Data Perencanaan (SKP) belum bisa diajukan karena RHK atasan belum tersedia.",
    "Pengelolaan Kinerja",
  ]);
  assert.equal(snapshot.elements[0]?.name, "Ajukan");
  assert.equal(snapshot.screenshotBase64, "/9j/2Q==");
});

test("a password field anywhere blocks the capture entirely", async () => {
  const reader = platform({
    async pageText() {
      return { ...ERROR_PAGE, hasPasswordField: true };
    },
  });
  const snapshot = await createScreenReader(reader).readActiveWindow();
  assert.deepEqual(
    [snapshot.blocked, snapshot.blockedReason, snapshot.texts, snapshot.screenshotBase64],
    [true, "password_field", [], null],
  );
  assert.equal(reader.captures, 0, "no pixels are taken");
});

test("a login or OTP window is blocked by its title", async () => {
  const reader = platform({
    async foregroundWindow() {
      return {
        title: "Masuk - AlurSekolah",
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        processName: "chrome.exe",
      };
    },
  });
  const snapshot = await createScreenReader(reader).readActiveWindow();
  assert.deepEqual([snapshot.blocked, snapshot.blockedReason], [true, "login_title"]);
  assert.equal(reader.captures, 0);
});

test("outside the browser only UI Automation is asked; a failing source doesn't break the snapshot", async () => {
  let pageAsked = false;
  const reader = platform({
    async foregroundWindow() {
      return {
        title: "WhatsApp",
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        processName: "WhatsApp.exe",
      };
    },
    async pageText() {
      pageAsked = true;
      return ERROR_PAGE;
    },
    async accessibleText() {
      throw new Error("UIA timed out");
    },
  });
  const snapshot = await createScreenReader(reader).readActiveWindow();
  assert.equal(pageAsked, false);
  assert.deepEqual(snapshot.texts, []);
  assert.ok(snapshot.screenshotBase64);
});

test("UIA replies become texts and pointable elements; offscreen items and values are ignored", () => {
  const parsed = parseUiaReply(
    JSON.stringify({
      ok: true,
      items: [
        {
          n: "Gagal menyimpan: sesi berakhir",
          t: "Text",
          p: false,
          x: 1,
          y: 2,
          w: 3,
          h: 4,
          off: false,
        },
        { n: "Masuk", t: "Button", p: false, x: 100, y: 200, w: 80, h: 30, off: false },
        { n: "Hidden", t: "Text", p: false, x: 0, y: 0, w: 0, h: 0, off: true },
        { n: "", t: "Edit", p: true, x: 0, y: 0, w: 0, h: 0, off: false },
      ],
    }),
  );
  assert.deepEqual(parsed, {
    url: null,
    texts: ["Gagal menyimpan: sesi berakhir"],
    elements: [
      { name: "Masuk", controlType: "Button", rect: { x: 100, y: 200, width: 80, height: 30 } },
    ],
    hasPasswordField: true,
  });
  assert.equal(parseUiaReply('{"ok":false,"error":"denied"}'), null);
  assert.equal(parseUiaReply("not json"), null);
});

test("window bounds map to thumbnail pixels on a 125% display and are clamped", () => {
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25 };
  assert.deepEqual(
    cropRect({ x: 100, y: 50, width: 800, height: 600 }, display, { width: 1920, height: 1080 }),
    {
      x: 125,
      y: 63,
      width: 1000,
      height: 750,
    },
  );
  assert.deepEqual(
    cropRect({ x: 1400, y: -10, width: 800, height: 600 }, display, { width: 1920, height: 1080 })
      .width,
    170,
  );
});
