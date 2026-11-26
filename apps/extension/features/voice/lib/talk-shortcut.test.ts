import { describe, expect, test } from "vite-plus/test";

import {
  createHoldDetector,
  DEFAULT_TALK_SHORTCUT,
  type KeyInput,
  parseShortcut,
  shortcutKeys,
  type TalkShortcut,
} from "./talk-shortcut";

const ctrlSpace = parseShortcut(DEFAULT_TALK_SHORTCUT) as TalkShortcut;

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

describe("parseShortcut", () => {
  test("reads the default Ctrl + Space and labels it in Indonesian", () => {
    expect(ctrlSpace).toEqual({ ctrl: true, alt: false, shift: false, meta: false, code: "Space" });
    expect(shortcutKeys(ctrlSpace)).toEqual(["Ctrl", "Spasi"]);
  });

  test("accepts another combination a school may pick in WS-08", () => {
    const shortcut = parseShortcut("Alt + Shift + n");
    expect(shortcut).toEqual({ ctrl: false, alt: true, shift: true, meta: false, code: "KeyN" });
    expect(shortcutKeys(shortcut as TalkShortcut)).toEqual(["Alt", "Shift", "N"]);
  });

  test("refuses a bare key, two main keys, or an unknown key", () => {
    expect(parseShortcut("Space")).toBeNull();
    expect(parseShortcut("Ctrl+A+B")).toBeNull();
    expect(parseShortcut("Ctrl+F13")).toBeNull();
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
