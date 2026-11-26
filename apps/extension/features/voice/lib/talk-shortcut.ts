/**
 * The key combination the teacher holds to talk (PRD §6). The school sets it in WS-08 (#212); until
 * that setting reaches the extension, every page uses `DEFAULT_TALK_SHORTCUT`.
 */
export type TalkShortcut = {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** `KeyboardEvent.code` of the main key, e.g. "Space". */
  code: string;
};

export const DEFAULT_TALK_SHORTCUT = "Ctrl+Space";

/** The combination every page uses until WS-08 sends the school's own (#212). */
export const TALK_SHORTCUT: TalkShortcut = {
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  code: "Space",
};

const MODIFIER_NAMES: Record<string, keyof Omit<TalkShortcut, "code">> = {
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  shift: "shift",
  meta: "meta",
  cmd: "meta",
  command: "meta",
};

const MODIFIER_LABELS = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Cmd" } as const;

function keyCode(name: string): string | null {
  if (name === "space" || name === "spasi") return "Space";
  if (/^[a-z]$/u.test(name)) return `Key${name.toUpperCase()}`;
  if (/^[0-9]$/u.test(name)) return `Digit${name}`;
  return null;
}

/**
 * "Ctrl+Space" → a shortcut, or null when the text names no key or no modifier: a bare key would
 * type into the page's fields.
 */
export function parseShortcut(text: string): TalkShortcut | null {
  const shortcut: TalkShortcut = { ctrl: false, alt: false, shift: false, meta: false, code: "" };
  for (const part of text.split("+").map((piece) => piece.trim().toLowerCase())) {
    const modifier = MODIFIER_NAMES[part];
    if (modifier) {
      shortcut[modifier] = true;
      continue;
    }
    const code = keyCode(part);
    if (!code || shortcut.code) return null;
    shortcut.code = code;
  }
  const hasModifier = shortcut.ctrl || shortcut.alt || shortcut.shift || shortcut.meta;
  return shortcut.code && hasModifier ? shortcut : null;
}

/** The keys to draw in the hint, in Indonesian: ["Ctrl", "Spasi"]. */
export function shortcutKeys(shortcut: TalkShortcut): string[] {
  const modifiers = (["ctrl", "alt", "shift", "meta"] as const)
    .filter((name) => shortcut[name])
    .map((name) => MODIFIER_LABELS[name]);
  const key = shortcut.code === "Space" ? "Spasi" : shortcut.code.replace(/^(Key|Digit)/u, "");
  return [...modifiers, key];
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
