import { cn } from "@nemu/ui/lib/utils";

import type { Box } from "../../../shared/types/box";

/** Round amber handles on the corners of the box, centered on its dashed border. */
const CORNERS = [
  "-top-1.5 -left-1.5",
  "-top-1.5 -right-1.5",
  "-bottom-1.5 -left-1.5",
  "-right-1.5 -bottom-1.5",
];

type AreaOutlineProps = {
  box: Box;
  /** Nemu is reading the area: the box stays as a grey dashed outline, without handles. */
  reading?: boolean;
  className?: string;
};

/**
 * The Blok area box from the design system: dashed amber with round amber corner handles while
 * it is dragged and attached, then a grey dashed outline while Nemu reads it.
 */
export function AreaOutline({ box, reading = false, className }: AreaOutlineProps) {
  return (
    <div
      data-nemu-area={reading ? "reading" : "selected"}
      className={cn(
        "absolute rounded-sm border-2 border-dashed",
        reading ? "border-muted-foreground/60" : "border-nemu-ring",
        className,
      )}
      style={box}
    >
      {!reading &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            className={`absolute size-3 rounded-full bg-nemu-ring ring-2 ring-white ${corner}`}
          />
        ))}
    </div>
  );
}
