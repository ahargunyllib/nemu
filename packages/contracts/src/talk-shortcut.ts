/**
 * The key combination a teacher holds to talk (PRD §6). The school sets it in WS-08; the Admin
 * Workspace checks it with `parseShortcut`, and the extension listens for the parsed keys.
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

/** The keys to draw in a hint, in Indonesian: ["Ctrl", "Spasi"]. */
export function shortcutKeys(shortcut: TalkShortcut): string[] {
  const modifiers = (["ctrl", "alt", "shift", "meta"] as const)
    .filter((name) => shortcut[name])
    .map((name) => MODIFIER_LABELS[name]);
  const key = shortcut.code === "Space" ? "Spasi" : shortcut.code.replace(/^(Key|Digit)/u, "");
  return [...modifiers, key];
}

/** The stored form of a shortcut, so "ctrl + spasi" and "Ctrl+Space" save the same: "Ctrl+Space". */
export function formatShortcut(shortcut: TalkShortcut): string {
  const modifiers = (["ctrl", "alt", "shift", "meta"] as const)
    .filter((name) => shortcut[name])
    .map((name) => MODIFIER_LABELS[name]);
  return [...modifiers, shortcut.code.replace(/^(Key|Digit)/u, "")].join("+");
}
