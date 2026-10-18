import { MASCOT_SIZE, type Point } from "../lib/mascot-position";

/** Room the chip needs on the mascot's left before it moves to the right instead. */
const HINT_ROOM = 240;
const GAP = 8;

/**
 * The Hotkey hint from the design system: while the Composer is open beside the mascot, an amber
 * chip on the mascot's other side shows the shortcut that opens the Composer (the extension's
 * `_execute_action` command, Ctrl+Shift+Space, also on a Mac).
 */
export function HotkeyHint({ mascotAt }: { mascotAt: Point }) {
  // The Composer opens below and to the right of the mascot, so the chip goes on its left.
  const left = mascotAt.x >= HINT_ROOM;
  return (
    <div
      className="absolute top-0 flex items-center"
      style={{
        height: MASCOT_SIZE,
        ...(left ? { right: MASCOT_SIZE + GAP } : { left: MASCOT_SIZE + GAP }),
      }}
    >
      <span className="flex animate-in items-center gap-1.5 rounded-4xl bg-nemu px-3 py-1 text-[11.5px]/[15px] font-medium whitespace-nowrap text-nemu-foreground shadow-md fade-in motion-reduce:animate-none">
        Hotkey
        <span className="opacity-80">Ctrl + Shift +</span>
        <kbd className="rounded-md bg-nemu-soft px-1.5 font-sans">Space</kbd>
      </span>
    </div>
  );
}
