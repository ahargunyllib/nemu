import { useEffect, useRef, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { isUsableSelection, type Point, selectionBox } from "../lib/area-crop";
import { AreaOutline } from "./area-outline";

type AreaSelectLayerProps = {
  onSelect: (selection: Box) => void;
  onCancel: () => void;
  /** The box while it is dragged, then null once released: the mascot sits at its corner. */
  onDrag?: (selection: Box | null) => void;
};

/**
 * Blok area from the design system: covers the viewport so Rina can drag a box around the part of
 * the page she is asking about. The page stays as it is, undimmed; the box is a light blue fill in
 * a dashed blue line with round amber corner handles.
 */
export function AreaSelectLayer({ onSelect, onCancel, onDrag }: AreaSelectLayerProps) {
  const [start, setStart] = useState<Point | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  // Focused so Esc reaches it: keys inside the overlay never reach the page or the window.
  useEffect(() => layer.current?.focus(), []);

  function drag(box: Box | null) {
    setSelection(box);
    onDrag?.(box);
  }

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
        drag(selectionBox(point, point));
      }}
      onPointerMove={(event) => {
        if (start) drag(selectionBox(start, { x: event.clientX, y: event.clientY }));
      }}
      onPointerUp={(event) => {
        if (!start) return;
        const box = selectionBox(start, { x: event.clientX, y: event.clientY });
        setStart(null);
        drag(null);
        if (isUsableSelection(box)) onSelect(box);
      }}
    >
      {/* Centered with margins, not translate: Tailwind's translate variables stay unset in the
          shadow root, where @property registrations don't apply. */}
      {!start && (
        <p className="absolute inset-x-0 top-4 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-2xl bg-nemu px-4 py-2.5 text-sm text-nemu-foreground shadow-lg">
          Seret area di layar <span className="opacity-80">· Esc batal</span>
        </p>
      )}
      {selection && <AreaOutline box={selection} />}
    </div>
  );
}
