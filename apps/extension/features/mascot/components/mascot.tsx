import { Button } from "@nemu/ui/components/button";
import { XIcon } from "lucide-react";
import { useState } from "react";

import type { CursorFrame } from "../../navigation-click/lib/navigation-click";
import { useMascotPosition } from "../hooks/use-mascot-position";
import { useMascotState } from "../hooks/use-mascot-state";
import { MASCOT_ART, MASCOT_MOTION } from "../lib/mascot-art";
import { HotkeyHint } from "./hotkey-hint";
import type { Point } from "../lib/mascot-position";
import type { MascotActivity } from "../lib/mascot-state";

type MascotProps = {
  activity: MascotActivity;
  /** Where the Composer opened, while it is open: the mascot waits beside it. */
  composerAnchor: Point | null;
  /** Nemu's cursor during a navigation click: the mascot rides along with it. */
  nemuCursor: CursorFrame | null;
  /** Where the mascot waits otherwise, such as a guided step card's top-left corner. */
  perch?: Point | null;
  onOpenComposer: (position: Point) => void;
  /** Hiding the mascot also closes the Composer it waits beside. */
  onCloseComposer: () => void;
};

/**
 * The Nemu mascot on the page layer. It follows the cursor and shows what Nemu is doing; clicking
 * it opens the Composer, beside which it shows the shortcut that opens it too. Hidden, it closes the
 * Composer and stays away until Rina opens it again.
 */
export function Mascot({
  activity,
  composerAnchor,
  nemuCursor,
  perch = null,
  onOpenComposer,
  onCloseComposer,
}: MascotProps) {
  const state = useMascotState(activity);
  const placement = useMascotPosition(composerAnchor, nemuCursor, perch);
  const [hidden, setHidden] = useState(false);
  const [wasListening, setWasListening] = useState(activity.listening);

  // Only opening the Composer brings it back, so hiding sticks while the Composer is still open.
  if (wasListening !== activity.listening) {
    setWasListening(activity.listening);
    if (activity.listening) setHidden(false);
  }
  if (hidden || !placement) return null;

  return (
    <div
      data-mascot-state={state}
      className="group pointer-events-auto absolute top-0 left-0 ease-in-out motion-reduce:transition-none"
      style={{
        transform: `translate(${placement.at.x}px, ${placement.at.y}px)`,
        transitionProperty: "transform",
        transitionDuration: `${placement.moveMs}ms`,
      }}
    >
      <Button
        aria-label="Tanya Nemu"
        size="icon-sm"
        variant="ghost"
        onClick={(event) => onOpenComposer({ x: event.clientX, y: event.clientY })}
      >
        {/* The art is bundled SVG from assets/, never page or server content. */}
        <span
          key={state}
          className={`size-full drop-shadow-sm motion-reduce:animate-none ${MASCOT_MOTION[state]}`}
          dangerouslySetInnerHTML={{ __html: MASCOT_ART[state] }}
        />
      </Button>
      {composerAnchor && <HotkeyHint mascotAt={placement.at} />}
      <Button
        aria-label="Sembunyikan maskot"
        size="icon-xs"
        variant="secondary"
        className="invisible absolute -top-3 -right-3 shadow-sm group-hover:visible"
        onClick={() => {
          setHidden(true);
          onCloseComposer();
        }}
      >
        <XIcon />
      </Button>
    </div>
  );
}
