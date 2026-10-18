import type { NemuAction } from "@nemu/contracts";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { cn } from "@nemu/ui/lib/utils";

import type { Box } from "../../../shared/types/box";
import { MASCOT_ART } from "../../mascot/lib/mascot-art";
import { LABEL_SPACE, labelGrowsLeft, RING_PADDING } from "../lib/highlight-targets";

const LABEL_OVERLAP = 8;

type HighlightRingProps = { box: Box; action: NemuAction };

/**
 * Tingkat 0 of the design system: the target outlined, with its label pinned to the outline's
 * top-right edge (bottom edge near the top of the viewport). A `highlight` gets Sorot arahkan, a
 * glowing amber outline; a `confirm` gets Sorot konfirmasi, a dashed blue outline that fades in,
 * and a green label, because the user, not Nemu, sends it.
 */
export function HighlightRing({ box, action }: HighlightRingProps) {
  const confirm = action.type === "confirm";
  const labelBelow = box.top - RING_PADDING < LABEL_SPACE;
  const [head, ...rest] = action.label.split(" · ");
  // The label sits on the outline's edge, overlapping it by LABEL_OVERLAP, so it covers as little
  // of the target and what is beside it as it can.
  const labelShift = labelBelow
    ? `translateY(-${LABEL_OVERLAP}px)`
    : `translateY(calc(-100% + ${LABEL_OVERLAP}px))`;

  return (
    <div
      data-nemu-highlight={action.type}
      className="absolute"
      style={{
        left: box.left - RING_PADDING,
        top: box.top - RING_PADDING,
        width: box.width + 2 * RING_PADDING,
        height: box.height + 2 * RING_PADDING,
      }}
    >
      {/* Keyed by target, so each step's outline plays its entrance again. */}
      <div
        key={action.target}
        className={cn(
          "absolute inset-0 rounded-xl border-2 animate-in fade-in motion-reduce:animate-none",
          confirm
            ? "border-dashed border-nemu-confirm duration-250 zoom-in-95"
            : "border-nemu-ring shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-nemu-ring)_20%,transparent)]",
        )}
      >
        {!confirm && (
          <div className="absolute -inset-0.5 animate-pulse rounded-xl shadow-[0_0_16px_2px_var(--color-nemu-glow)] motion-reduce:animate-none" />
        )}
      </div>
      {/* Shifted with an inline transform, not translate utilities, whose variables don't reach
          the shadow root. A label wider than a small target such as a radio grows to the right
          (justify-end-safe falls back to the start), or to the left near the viewport's right
          edge, the way highlightFootprint expects. */}
      <div
        className={cn(
          "absolute inset-x-0 flex px-3",
          labelGrowsLeft(box, window.innerWidth) ? "justify-end" : "justify-end-safe",
          labelBelow ? "top-full" : "top-0",
        )}
        style={{ transform: labelShift }}
      >
        <NemuBadge
          tone={confirm ? "success" : "solid"}
          className="h-auto gap-1.5 py-1 pr-3 pl-1 text-sm shadow-md ring-2 ring-white"
        >
          {/* The art is bundled SVG from the mascot's assets, never page or server content. */}
          <span
            aria-hidden
            className="size-5 shrink-0 rounded-full bg-white p-0.5"
            dangerouslySetInnerHTML={{ __html: MASCOT_ART[confirm ? "success" : "guiding"] }}
          />
          {head}
          {rest.length > 0 && (
            <span className="font-normal opacity-80">{` · ${rest.join(" · ")}`}</span>
          )}
        </NemuBadge>
      </div>
    </div>
  );
}
