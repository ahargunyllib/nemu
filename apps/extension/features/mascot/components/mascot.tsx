import { Button } from "@nemu/ui/components/button";
import { useId } from "react";

import type { Box } from "../../../shared/types/box";
import type { CursorFrame } from "../../navigation-click/lib/navigation-click";
import { useMascotPosition } from "../hooks/use-mascot-position";
import { useMascotState } from "../hooks/use-mascot-state";
import { MASCOT_ART, MASCOT_MOTION } from "../lib/mascot-art";
import { MASCOT_SIZE, type Point } from "../lib/mascot-position";
import type { MascotActivity } from "../lib/mascot-state";

type MascotProps = {
  activity: MascotActivity;
  /** Where the Composer opened, while it is open: the mascot waits beside it. */
  composerAnchor: Point | null;
  /** Nemu's cursor during a navigation click: the mascot rides along with it. */
  nemuCursor: CursorFrame | null;
  /** The Blok area while Rina drags it: the mascot sits as the cursor at its bottom-right corner. */
  draggedArea?: Box | null;
  /** The Answer Card beside the highlighted target, while a step is highlighted: the mascot sits on
      its top-left corner. */
  guidingCard?: Box | null;
  onOpenComposer: (position: Point) => void;
};

/** Room beside the mascot for the "Klik untuk tanya Nemu" pill, before it moves to the other side. */
const CUE_ROOM = 168;

/**
 * The Nemu mascot on the page layer. It follows the cursor and shows what Nemu is doing; clicking
 * it opens the Composer, beside which it waits. When it stops because the cursor reaches for it, a
 * dashed amber ring and a dark pill say it can be clicked.
 */
export function Mascot({
  activity,
  composerAnchor,
  nemuCursor,
  draggedArea = null,
  guidingCard = null,
  onOpenComposer,
}: MascotProps) {
  const state = useMascotState(activity);
  const placement = useMascotPosition(composerAnchor, nemuCursor, draggedArea, guidingCard);
  const cueId = useId();
  if (!placement) return null;

  return (
    <div
      data-mascot-state={state}
      className="pointer-events-auto absolute top-0 left-0 ease-in-out motion-reduce:transition-none"
      style={{
        transform: `translate(${placement.at.x}px, ${placement.at.y}px)`,
        transitionProperty: "transform",
        transitionDuration: `${placement.moveMs}ms`,
      }}
    >
      {placement.waiting && (
        <ClickCue id={cueId} left={placement.at.x + MASCOT_SIZE + CUE_ROOM > window.innerWidth} />
      )}
      <Button
        aria-label="Tanya Nemu"
        aria-describedby={placement.waiting ? cueId : undefined}
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
    </div>
  );
}

/**
 * The cue that the waiting mascot can be clicked: a dashed amber ring around it and a dark pill
 * beside it, "Klik untuk tanya Nemu". The pill is level with the mascot's middle by a flex row, not
 * translate utilities, whose variables don't reach the shadow root.
 */
function ClickCue({ id, left }: { id: string; left: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 animate-in rounded-full border-[1.5px] border-dashed border-nemu-ring fade-in motion-reduce:animate-none"
      />
      <div
        className={`pointer-events-none absolute inset-y-0 flex items-center ${left ? "right-full pr-2.5" : "left-full pl-2.5"}`}
      >
        <span
          id={id}
          role="tooltip"
          className="animate-in rounded-full bg-foreground px-[11px] py-[5px] text-[11.5px]/[15px] font-medium whitespace-nowrap text-background shadow-nemu-float fade-in motion-reduce:animate-none"
        >
          Klik untuk tanya Nemu
        </span>
      </div>
    </>
  );
}
