import { useEffect, useState } from "react";

import type { CursorFrame } from "../../navigation-click/lib/navigation-click";
import {
  besideComposer,
  besideCursor,
  FOLLOW_MS,
  followCursor,
  type Point,
} from "../lib/mascot-position";

export type MascotPlacement = { at: Point; moveMs: number };

/**
 * Where the mascot is and how long it takes to get there. It follows Rina's cursor, waits beside
 * the Composer while that is open, rides along with Nemu's cursor during a navigation click, and
 * perches on a guided step's card while one is up. It has no place until the cursor first moves on
 * the page, unless it has a perch.
 */
export function useMascotPosition(
  composerAnchor: Point | null,
  nemuCursor: CursorFrame | null,
  perch: Point | null = null,
): MascotPlacement | null {
  const [followed, setFollowed] = useState<Point | null>(null);

  useEffect(() => {
    let previous: Point | null = null;
    function follow(event: MouseEvent) {
      const from = previous;
      const cursor = { x: event.clientX, y: event.clientY };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setFollowed((mascot) => followCursor(mascot, from, cursor, viewport));
      previous = cursor;
    }
    window.addEventListener("mousemove", follow, { passive: true });
    return () => window.removeEventListener("mousemove", follow);
  }, []);

  if (composerAnchor) return { at: besideComposer(composerAnchor), moveMs: FOLLOW_MS };
  if (nemuCursor) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return {
      at: besideCursor(nemuCursor.at, viewport),
      moveMs: (nemuCursor.mascot === "clicking" && nemuCursor.moveMs) || FOLLOW_MS,
    };
  }
  if (perch) return { at: perch, moveMs: FOLLOW_MS };
  return followed && { at: followed, moveMs: FOLLOW_MS };
}
