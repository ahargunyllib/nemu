import { describe, expect, test } from "vite-plus/test";

import type { Box } from "../../../shared/types/box";
import { PANEL_WIDTH, type PanelPlacement, type Viewport, placePanel } from "./panel-placement";

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const PANEL_HEIGHT = 320;

function panelBox(placement: PanelPlacement): Box {
  const height = Math.min(PANEL_HEIGHT, placement.maxHeight);
  const top = "top" in placement ? placement.top : VIEWPORT.height - placement.bottom - height;
  return { left: placement.left, top, width: PANEL_WIDTH, height };
}

function overlaps(a: Box, b: Box) {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

describe("placePanel", () => {
  test("opens below the cursor in the top half and above it in the bottom half", () => {
    expect(placePanel({ x: 100, y: 100 }, VIEWPORT, PANEL_HEIGHT, [])).toEqual({
      left: 112,
      top: 112,
      maxHeight: 676,
    });
    expect(placePanel({ x: 100, y: 700 }, VIEWPORT, PANEL_HEIGHT, [])).toEqual({
      left: 112,
      bottom: 112,
      maxHeight: 676,
    });
  });

  test("never covers a highlighted element", () => {
    // The cursor sits right on the highlighted option, as when Rina points at the lodging field.
    const highlighted: Box = { left: 300, top: 360, width: 240, height: 80 };

    const placement = placePanel({ x: 320, y: 300 }, VIEWPORT, PANEL_HEIGHT, [highlighted]);

    expect(overlaps(panelBox(placement), highlighted)).toBe(false);
  });

  test("moves to the other side when the highlight sits on the right", () => {
    const highlighted: Box = { left: 900, top: 40, width: 360, height: 720 };

    const placement = placePanel({ x: 1000, y: 200 }, VIEWPORT, PANEL_HEIGHT, [highlighted]);

    expect(overlaps(panelBox(placement), highlighted)).toBe(false);
    expect(placement.left).toBe(12);
  });

  test("covers as little as possible when no spot is free", () => {
    const everywhere: Box = { left: 0, top: 0, width: VIEWPORT.width, height: 600 };

    const placement = placePanel({ x: 100, y: 100 }, VIEWPORT, PANEL_HEIGHT, [everywhere]);

    expect(placement).toEqual({
      left: VIEWPORT.width - PANEL_WIDTH - 12,
      bottom: 12,
      maxHeight: 776,
    });
  });
});
