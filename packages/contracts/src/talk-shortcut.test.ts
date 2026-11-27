import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_TALK_SHORTCUT,
  formatShortcut,
  parseShortcut,
  shortcutKeys,
} from "./talk-shortcut.js";

test("reads the default Ctrl + Space and labels it in Indonesian", () => {
  const shortcut = parseShortcut(DEFAULT_TALK_SHORTCUT);
  assert.deepEqual(shortcut, { ctrl: true, alt: false, shift: false, meta: false, code: "Space" });
  assert.ok(shortcut);
  assert.deepEqual(shortcutKeys(shortcut), ["Ctrl", "Spasi"]);
});

test("accepts another combination a school may pick in WS-08, and stores it in one form", () => {
  const shortcut = parseShortcut("Alt + Shift + n");
  assert.deepEqual(shortcut, { ctrl: false, alt: true, shift: true, meta: false, code: "KeyN" });
  assert.ok(shortcut);
  assert.deepEqual(shortcutKeys(shortcut), ["Alt", "Shift", "N"]);
  assert.equal(formatShortcut(shortcut), "Alt+Shift+N");
  const spasi = parseShortcut("ctrl + spasi");
  assert.ok(spasi);
  assert.equal(formatShortcut(spasi), "Ctrl+Space");
});

test("refuses a bare key, two main keys, or an unknown key", () => {
  assert.equal(parseShortcut("Space"), null);
  assert.equal(parseShortcut("Ctrl+A+B"), null);
  assert.equal(parseShortcut("Ctrl+F13"), null);
});
