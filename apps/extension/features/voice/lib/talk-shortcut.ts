import { parseShortcut, type TalkShortcut } from "@nemu/contracts/talk-shortcut";

/** Ctrl + Space, held to talk unless the school picked another combination (WS-08). */
const CTRL_SPACE: TalkShortcut = {
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  code: "Space",
};

/**
 * The combination a page listens for: the school's WS-08 setting from `extensionConfig`, or Ctrl +
 * Space when the school has none or the stored one can't be heard.
 */
export function talkShortcutFrom(setting: string | undefined): TalkShortcut {
  return (setting && parseShortcut(setting)) || CTRL_SPACE;
}

/** The parts of a `KeyboardEvent` the detector reads, so tests can pass plain objects. */
export type KeyInput = {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
};

/**
 * `press` when the combination goes down, `hold` for its auto-repeat (swallow it so the page doesn't
 * get a stream of spaces), `release` when its key or one of its modifiers comes up.
 */
export type HoldSignal = "press" | "hold" | "release" | null;

const MODIFIER_KEYS = { ctrl: "Control", alt: "Alt", shift: "Shift", meta: "Meta" } as const;

export function createHoldDetector(shortcut: TalkShortcut) {
  let held = false;

  function isCombination(event: KeyInput) {
    return (
      event.code === shortcut.code &&
      event.ctrlKey === shortcut.ctrl &&
      event.altKey === shortcut.alt &&
      event.shiftKey === shortcut.shift &&
      event.metaKey === shortcut.meta
    );
  }

  function releasesModifier(event: KeyInput) {
    return (["ctrl", "alt", "shift", "meta"] as const).some(
      (name) => shortcut[name] && event.key === MODIFIER_KEYS[name],
    );
  }

  return {
    keydown(event: KeyInput): HoldSignal {
      if (held) return event.code === shortcut.code ? "hold" : null;
      if (event.repeat || !isCombination(event)) return null;
      held = true;
      return "press";
    },
    keyup(event: KeyInput): HoldSignal {
      if (!held || (event.code !== shortcut.code && !releasesModifier(event))) return null;
      held = false;
      return "release";
    },
    /** The page lost focus mid-hold, so no keyup will come: whether a hold was dropped. */
    cancel(): boolean {
      const wasHeld = held;
      held = false;
      return wasHeld;
    },
  };
}
