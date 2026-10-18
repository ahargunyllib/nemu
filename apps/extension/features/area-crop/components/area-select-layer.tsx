import { useEffect, useRef, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { isUsableSelection, type Point, selectionBox } from "../lib/area-crop";

/** Round amber handles on the corners of the box, centered on its dashed border. */
const CORNERS = [
  "-top-1.5 -left-1.5",
  "-top-1.5 -right-1.5",
  "-bottom-1.5 -left-1.5",
  "-right-1.5 -bottom-1.5",
];

type AreaSelectLayerProps = {
  onSelect: (selection: Box) => void;
  onCancel: () => void;
};

/**
 * Blok area from the design system: covers the viewport so Rina can drag a box around the part of
 * the page she is asking about. The rest of the page dims, and the box is dashed blue with round
 * amber corner handles.
 */
export function AreaSelectLayer({ onSelect, onCancel }: AreaSelectLayerProps) {
  const [start, setStart] = useState<Point | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  // Focused so Esc reaches it: keys inside the overlay never reach the page or the window.
  useEffect(() => layer.current?.focus(), []);

  return (
    <div
      ref={layer}
      role="application"
      aria-label="Pilih area"
      tabIndex={-1}
      className="fixed inset-0 z-2147483647 cursor-crosshair touch-none outline-none select-none"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        setStart(point);
        setSelection(selectionBox(point, point));
      }}
      onPointerMove={(event) => {
        if (start) setSelection(selectionBox(start, { x: event.clientX, y: event.clientY }));
      }}
      onPointerUp={(event) => {
        if (!start) return;
        const box = selectionBox(start, { x: event.clientX, y: event.clientY });
        setStart(null);
        setSelection(null);
        if (isUsableSelection(box)) onSelect(box);
      }}
    >
      {!start && (
        // The page dims until a box is dragged; the dragged box's shadow takes over the dimming.
        <div className="absolute inset-0 bg-black/40">
          {/* Centered with margins, not translate: Tailwind's translate variables stay unset in
              the shadow root, where @property registrations don't apply. */}
          <p className="absolute inset-x-0 top-4 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-2xl bg-nemu px-4 py-2.5 text-sm text-nemu-foreground shadow-lg">
            Seret area di layar <span className="opacity-80">· Esc batal</span>
          </p>
        </div>
      )}
      {selection && (
        <div
          className="absolute rounded-sm border-2 border-dashed border-nemu-confirm shadow-[0_0_0_100vmax_rgb(0_0_0/40%)]"
          style={selection}
        >
          {CORNERS.map((corner) => (
            <span
              key={corner}
              className={`absolute size-3 rounded-full bg-nemu-ring ring-2 ring-white ${corner}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
