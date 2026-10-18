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
 * The Blok area box from the design system: a light blue fill inside a 1.5 px dashed blue line
 * (dash 5, gap 4) with round amber corner handles while it is dragged and attached, then a grey
 * dashed outline while Nemu reads it.
 */
export function AreaOutline({ box, reading = false, className }: AreaOutlineProps) {
  if (reading) {
    return (
      <div
        data-nemu-area="reading"
        className={cn(
          "absolute rounded-sm border-2 border-dashed border-muted-foreground/60",
          className,
        )}
        style={box}
      />
    );
  }

  return (
    <div
      data-nemu-area="selected"
      className={cn("absolute rounded-sm bg-nemu-select-fill", className)}
      style={box}
    >
      {/* A CSS dashed border can't set its dash and gap, so the line is an SVG stroke. */}
      <svg aria-hidden className="absolute inset-0 size-full overflow-visible">
        <rect
          width="100%"
          height="100%"
          rx="4"
          fill="none"
          className="stroke-nemu-select"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      </svg>
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={`absolute size-3 rounded-full bg-nemu-ring ring-2 ring-white ${corner}`}
        />
      ))}
    </div>
  );
}
