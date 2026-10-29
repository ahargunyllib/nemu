import { useEffect, useState } from "react";

import type { Box } from "../../../shared/types/box";
import type { CursorFrame } from "../../navigation-click/lib/navigation-click";
import {
  atAreaCorner,
  atCardCorner,
  besideComposer,
  besideCursor,
  FOLLOW_MS,
  type Followed,
  followCursor,
  type Point,
} from "../lib/mascot-position";

export type MascotPlacement = {
  at: Point;
  moveMs: number;
  /** Set while the mascot has stopped because the cursor is reaching for it: it can be clicked. */
  waiting?: boolean;
};

/**
 * Where the mascot is and how long it takes to get there. It follows Rina's cursor, waits beside
 * the Composer while that is open, sits at the corner of a Blok area while Rina drags it, rides
 * along with Nemu's cursor during a navigation click, and while a step is highlighted flies to the
 * corner of the Answer Card beside the target.
 * It has no place until the cursor first moves on the page.
 */
export function useMascotPosition(
  composerAnchor: Point | null,
  nemuCursor: CursorFrame | null,
  draggedArea: Box | null = null,
  guidingCard: Box | null = null,
): MascotPlacement | null {
  const [followed, setFollowed] = useState<Followed | null>(null);

  useEffect(() => {
    let previous: Point | null = null;
    function follow(event: MouseEvent) {
      const from = previous;
      const cursor = { x: event.clientX, y: event.clientY };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setFollowed((mascot) => followCursor(mascot?.at ?? null, from, cursor, viewport));
      previous = cursor;
    }
    window.addEventListener("mousemove", follow, { passive: true });
    return () => window.removeEventListener("mousemove", follow);
  }, []);

  // Area select mode keeps the Composer open, so the dragged box comes first. It keeps up at once.
  if (draggedArea) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return { at: atAreaCorner(draggedArea, viewport), moveMs: 0 };
  }
  // A Composer opened while a step is highlighted sits in that card, so the card comes first.
  if (guidingCard) return { at: atCardCorner(guidingCard), moveMs: FOLLOW_MS };
  if (composerAnchor) return { at: besideComposer(composerAnchor), moveMs: FOLLOW_MS };
  if (nemuCursor) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return {
      at: besideCursor(nemuCursor.at, viewport),
      moveMs: (nemuCursor.mascot === "clicking" && nemuCursor.moveMs) || FOLLOW_MS,
    };
  }
  return followed && { ...followed, moveMs: FOLLOW_MS };
}
