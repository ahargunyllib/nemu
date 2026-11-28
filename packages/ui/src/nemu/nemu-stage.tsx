import { useElementRect } from "@nemu/ui/hooks/use-element-rect";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import {
  CURSOR_SIZE,
  HIGHLIGHT_OFFSET,
  type Point,
  type Rect,
  type Size,
  cursorPoint,
  placeBubble,
} from "@nemu/ui/lib/nemu-placement";
import { GelembungJawab } from "@nemu/ui/nemu/gelembung-jawab";
import { GelembungKerja } from "@nemu/ui/nemu/gelembung-kerja";
import { GelembungTunjuk } from "@nemu/ui/nemu/gelembung-tunjuk";
import { KartuInfo } from "@nemu/ui/nemu/kartu-info";
import { KartuPilih } from "@nemu/ui/nemu/kartu-pilih";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { NemuMascot } from "@nemu/ui/nemu/nemu-mascot";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

/** How long the cursor takes to glide to its next target (F0-16). */
export const GLIDE_MS = 600;

/** Draws one display type; the union makes two at once impossible. */
export function NemuDisplayView({ display }: { display: NemuDisplay }) {
  switch (display.type) {
    case "kerja":
      return <GelembungKerja {...display} />;
    case "tunjuk":
      return <GelembungTunjuk {...display} />;
    case "jawab":
      return <GelembungJawab {...display} />;
    case "pilih":
      return <KartuPilih {...display} />;
    case "info":
      return <KartuInfo {...display} />;
  }
}

type NemuStageProps = {
  /** The one thing Nemu shows now, or nothing. */
  display: NemuDisplay | null;
  /** The page element it is about. Without one the display stays where the stage is placed. */
  target?: Element | null;
  /** Called once the display is up (after the cursor arrives), so Nemu can say it. */
  onShown?: (display: NemuDisplay) => void;
};

/**
 * Everything Nemu shows on the page, one at a time. With a target, the Nemu cursor glides to it
 * (~0.6 s), rings it, and only then does the display appear, on the free side of the cursor.
 */
export function NemuStage({ display, target = null, onShown }: NemuStageProps) {
  // Where the cursor last stood, so the next glide starts there.
  const rest = useRef<Point | null>(null);
  if (!display) return null;
  if (!target) return <DockedDisplay display={display} onShown={onShown} />;
  return <PointedDisplay display={display} target={target} rest={rest} onShown={onShown} />;
}

function DockedDisplay({
  display,
  onShown,
}: {
  display: NemuDisplay;
  onShown?: (display: NemuDisplay) => void;
}) {
  useEffect(() => onShown?.(display), [display, onShown]);
  return <NemuDisplayView display={display} />;
}

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

const PAGE_CONTROLS =
  "input:not([type=hidden]), select, textarea, button, a[href], [role=button], [contenteditable=true]";

/** The page's own visible controls besides the target: the bubble steps around them. */
function pageControls(target: Element, viewport: Size): Rect[] {
  const rects: Rect[] = [];
  for (const element of document.querySelectorAll(PAGE_CONTROLS)) {
    if (element === target) continue;
    const { left, top, width, height } = element.getBoundingClientRect();
    const visible = width > 0 && height > 0 && left < viewport.width && top < viewport.height;
    if (visible && left + width > 0 && top + height > 0) rects.push({ left, top, width, height });
  }
  return rects;
}

type PointedDisplayProps = {
  display: NemuDisplay;
  target: Element;
  rest: { current: Point | null };
  onShown?: (display: NemuDisplay) => void;
};

function PointedDisplay({ display, target, rest, onShown }: PointedDisplayProps) {
  const rect = useElementRect(target);
  const viewport = viewportSize();
  const [arrivedAt, setArrivedAt] = useState<Element | null>(null);
  const arrived = arrivedAt === target;

  useEffect(() => {
    const timer = setTimeout(() => setArrivedAt(target), GLIDE_MS);
    return () => clearTimeout(timer);
  }, [target]);

  useEffect(() => {
    if (arrived) onShown?.(display);
  }, [arrived, display, onShown]);

  const point = rect ? cursorPoint(rect, viewport) : null;
  useEffect(() => {
    if (point) rest.current = point;
  });

  if (!rect || !point) return null;
  // The first glide starts from the Nemu button's corner of the window.
  const from = rest.current ?? { x: viewport.width - 52, y: viewport.height - 52 };
  return (
    <>
      {/* Once arrived, the bubble sits beside the cursor and the label would only crowd it. */}
      <NemuCursor from={from} to={point} gliding={!arrived} labelled={!arrived} />
      {arrived && <TargetRing rect={rect} />}
      {arrived && (
        <PlacedBubble target={target} rect={rect} viewport={viewport}>
          <NemuDisplayView display={display} />
        </PlacedBubble>
      )}
    </>
  );
}

type NemuCursorProps = {
  from: Point;
  to: Point;
  gliding: boolean;
  /** Shows the "Nemu" label beside the mascot; off while a bubble is attached to the cursor. */
  labelled: boolean;
};

/** The Nemu cursor: the 44 px click-through mascot, labelled "Nemu", gliding to its next point. */
function NemuCursor({ from, to, gliding, labelled }: NemuCursorProps) {
  const [start] = useState(from);
  const [launched, setLaunched] = useState(false);

  // Paint the start first; changing the position in the same frame would skip the glide.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setLaunched(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const at = launched ? to : start;
  return (
    <div
      aria-hidden
      data-nemu-cursor={gliding ? "gliding" : "arrived"}
      data-x={at.x}
      data-y={at.y}
      className="pointer-events-none fixed top-0 left-0"
      style={{
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        transform: `translate(${at.x - CURSOR_SIZE / 2}px, ${at.y - CURSOR_SIZE / 2}px)`,
        transition: gliding ? `transform ${GLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : "none",
      }}
    >
      <NemuMascot />
      {labelled && (
        <NemuBadge className="absolute top-1/2 left-full -translate-y-1/2 border-white font-semibold shadow-nemu-float">
          Nemu
        </NemuBadge>
      )}
    </div>
  );
}

/** Sorot arahkan: a 2 px dark orange ring 4 px outside the target (docs/design-system.md). */
function TargetRing({ rect }: { rect: Rect }) {
  return (
    <div
      aria-hidden
      data-nemu-ring
      className="pointer-events-none fixed rounded-[10px] border-2 border-nemu-amber-600 duration-250 animate-in fade-in"
      style={{
        left: rect.left - HIGHLIGHT_OFFSET,
        top: rect.top - HIGHLIGHT_OFFSET,
        width: rect.width + HIGHLIGHT_OFFSET * 2,
        height: rect.height + HIGHLIGHT_OFFSET * 2,
      }}
    />
  );
}

/** Measures the display, then puts it on the free side of the cursor, clear of the page's controls. */
function PlacedBubble({
  target,
  rect,
  viewport,
  children,
}: {
  target: Element;
  rect: Rect;
  viewport: Size;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) =>
        current && current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const placement = size ? placeBubble(rect, size, viewport, pageControls(target, viewport)) : null;
  return (
    <div
      ref={ref}
      data-nemu-side={placement?.side}
      className="pointer-events-auto fixed top-0 left-0 duration-200 animate-in fade-in"
      style={{
        transform: placement ? `translate(${placement.left}px, ${placement.top}px)` : undefined,
        visibility: placement ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
}
