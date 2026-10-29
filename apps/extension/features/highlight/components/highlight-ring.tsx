import type { NemuAction } from "@nemu/contracts";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { cn } from "@nemu/ui/lib/utils";
import type { CSSProperties } from "react";

import type { Box } from "../../../shared/types/box";
import { MASCOT_ART } from "../../mascot/lib/mascot-art";
import {
  LABEL_GAP,
  LABEL_INSET,
  LABEL_OVERLAP,
  type LabelSide,
  labelSide,
  RING_PADDING,
} from "../lib/highlight-targets";

type HighlightRingProps = { box: Box; action: NemuAction };

/** Where the label sits against the outline, the way highlightFootprint expects. */
const LABEL_POSITION: Record<LabelSide, CSSProperties> = {
  right: { left: `calc(100% + ${LABEL_GAP}px)`, top: 0 },
  top: { right: LABEL_INSET, bottom: `calc(100% - ${LABEL_OVERLAP}px)` },
  bottom: { right: LABEL_INSET, top: `calc(100% - ${LABEL_OVERLAP}px)` },
};

/**
 * Tingkat 0 of the design system: the target outlined, with its label to the right of the outline
 * (on its top-right edge when there is no room). A `highlight` gets Sorot arahkan, a thin solid
 * amber outline; a `confirm` gets Sorot konfirmasi, a dashed blue outline, and a green label,
 * because the user, not Nemu, sends it.
 */
export function HighlightRing({ box, action }: HighlightRingProps) {
  const confirm = action.type === "confirm";
  const [head, ...rest] = action.label.split(" · ");

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
          "absolute inset-0 border-2 animate-in duration-250 fade-in motion-reduce:animate-none",
          confirm
            ? "rounded-xl border-dashed border-nemu-confirm zoom-in-95"
            : "rounded-[10px] border-nemu-amber-600",
        )}
      />
      <NemuBadge
        tone={confirm ? "success" : "solid"}
        className="absolute h-6.5 gap-1.5 rounded-full border-white py-0.75 pr-2.5 pl-0.75 text-xs leading-4 font-semibold shadow-nemu-float"
        style={LABEL_POSITION[labelSide(box, window.innerWidth)]}
      >
        {/* The art is bundled SVG from the mascot's assets, never page or server content. */}
        <span
          aria-hidden
          className="size-4.5 shrink-0 rounded-full bg-white p-px"
          dangerouslySetInnerHTML={{ __html: MASCOT_ART[confirm ? "success" : "guiding"] }}
        />
        {head}
        {rest.length > 0 && (
          <span className="font-normal opacity-80">{` · ${rest.join(" · ")}`}</span>
        )}
      </NemuBadge>
    </div>
  );
}
