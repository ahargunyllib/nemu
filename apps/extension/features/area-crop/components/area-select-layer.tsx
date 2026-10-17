import { Card, CardDescription, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { useEffect, useRef, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { isUsableSelection, type Point, selectionBox } from "../lib/area-crop";

type AreaSelectLayerProps = {
  onSelect: (selection: Box) => void;
  onCancel: () => void;
};

/** Covers the viewport so Rina can drag a box around the part of the page she is asking about. */
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
        <Card size="sm" className="absolute top-4 left-1/2 -translate-x-1/2 shadow-lg">
          <CardHeader>
            <CardTitle>Pilih area</CardTitle>
            <CardDescription>
              Seret kotak di sekitar bagian yang ingin ditanyakan · Esc batal
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {selection && (
        <div
          className="absolute rounded-sm border-2 border-primary bg-primary/10"
          style={selection}
        />
      )}
    </div>
  );
}
