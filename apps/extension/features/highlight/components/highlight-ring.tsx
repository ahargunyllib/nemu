import { Badge } from "@nemu/ui/components/badge";

import type { Box } from "../../../shared/types/box";
import { LABEL_SPACE, RING_PADDING } from "../lib/highlight-targets";

type HighlightRingProps = { box: Box; label: string };

/** A pulsing amber outline around a target with the action label above it (below, near the top). */
export function HighlightRing({ box, label }: HighlightRingProps) {
  const labelBelow = box.top - RING_PADDING < LABEL_SPACE;

  return (
    <div
      className="absolute"
      style={{
        left: box.left - RING_PADDING,
        top: box.top - RING_PADDING,
        width: box.width + 2 * RING_PADDING,
        height: box.height + 2 * RING_PADDING,
      }}
    >
      <div className="absolute inset-0 animate-pulse rounded-md outline-2 outline-amber-500 motion-reduce:animate-none" />
      <Badge className={labelBelow ? "absolute top-full mt-1" : "absolute bottom-full mb-1"}>
        {label}
      </Badge>
    </div>
  );
}
