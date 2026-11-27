import { describe, expect, test } from "vite-plus/test";

import { createHoldDetector, type KeyInput, talkShortcutFrom } from "./talk-shortcut";

const ctrlSpace = talkShortcutFrom("Ctrl+Space");

function key(overrides: Partial<KeyInput>): KeyInput {
  return {
    code: "Space",
    key: " ",
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    repeat: false,
    ...overrides,
  };
}

describe("talkShortcutFrom", () => {
  test("follows the school's WS-08 combination", () => {
    expect(talkShortcutFrom("Alt+Shift+N")).toEqual({
      ctrl: false,
      alt: true,
      shift: true,
      meta: false,
      code: "KeyN",
    });
  });

  test("falls back to Ctrl + Space without a setting or with one Nemu can't hear", () => {
    expect(talkShortcutFrom(undefined)).toEqual(ctrlSpace);
    expect(talkShortcutFrom("Space")).toEqual(ctrlSpace);
  });
});

describe("createHoldDetector", () => {
  test("presses on Ctrl + Space, swallows the auto-repeat, and releases on Space up", () => {
    const detector = createHoldDetector(ctrlSpace);
    expect(detector.keydown(key({}))).toBe("press");
    expect(detector.keydown(key({ repeat: true }))).toBe("hold");
    expect(detector.keyup(key({}))).toBe("release");
    expect(detector.keyup(key({}))).toBeNull();
  });

  test("releases when Ctrl comes up first", () => {
    const detector = createHoldDetector(ctrlSpace);
    detector.keydown(key({}));
    expect(detector.keyup(key({ code: "ControlLeft", key: "Control", ctrlKey: false }))).toBe(
      "release",
    );
  });

  test("ignores Space alone, Ctrl + Shift + Space, and other keys while held", () => {
    const detector = createHoldDetector(ctrlSpace);
    expect(detector.keydown(key({ ctrlKey: false }))).toBeNull();
    expect(detector.keydown(key({ shiftKey: true }))).toBeNull();
    detector.keydown(key({}));
    expect(detector.keydown(key({ code: "KeyA", key: "a" }))).toBeNull();
    expect(detector.keyup(key({ code: "KeyA", key: "a" }))).toBeNull();
  });

  test("a held combination dropped by a lost focus starts fresh", () => {
    const detector = createHoldDetector(ctrlSpace);
    expect(detector.cancel()).toBe(false);
    detector.keydown(key({}));
    expect(detector.cancel()).toBe(true);
    expect(detector.keyup(key({}))).toBeNull();
    expect(detector.keydown(key({}))).toBe("press");
  });
});
