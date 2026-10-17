import { Button } from "@nemu/ui/components/button";
import { XIcon } from "lucide-react";
import { useState } from "react";

import type { CursorFrame } from "../../navigation-click/lib/navigation-click";
import { useMascotPosition } from "../hooks/use-mascot-position";
import { useMascotState } from "../hooks/use-mascot-state";
import { MASCOT_ART, MASCOT_MOTION } from "../lib/mascot-art";
import type { Point } from "../lib/mascot-position";
import type { MascotActivity } from "../lib/mascot-state";

type MascotProps = {
  activity: MascotActivity;
  /** Where the Composer opened, while it is open: the mascot waits beside it. */
  composerAnchor: Point | null;
  /** Nemu's cursor during a navigation click: the mascot rides along with it. */
  nemuCursor: CursorFrame | null;
  onOpenComposer: (position: Point) => void;
};

/**
 * The Nemu mascot on the page layer. It follows the cursor and shows what Nemu is doing; clicking
 * it opens the Composer. Hidden, it stays away until Rina opens the Composer again.
 */
export function Mascot({ activity, composerAnchor, nemuCursor, onOpenComposer }: MascotProps) {
  const state = useMascotState(activity);
  const placement = useMascotPosition(composerAnchor, nemuCursor);
  const [hidden, setHidden] = useState(false);

  if (hidden && activity.listening) setHidden(false);
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
        className="text-primary"
        onClick={(event) => onOpenComposer({ x: event.clientX, y: event.clientY })}
      >
        {/* The art is bundled SVG from assets/, never page or server content. */}
        <span
          key={state}
          className={`size-full motion-reduce:animate-none ${MASCOT_MOTION[state]}`}
          dangerouslySetInnerHTML={{ __html: MASCOT_ART[state] }}
        />
      </Button>
      <Button
        aria-label="Sembunyikan maskot"
        size="icon-xs"
        variant="secondary"
        className="invisible absolute -top-3 -right-3 shadow-sm group-hover:visible"
        onClick={() => setHidden(true)}
      >
        <XIcon />
      </Button>
    </div>
  );
}
