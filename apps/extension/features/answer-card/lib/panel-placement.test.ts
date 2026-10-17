import { describe, expect, test } from "vite-plus/test";

import type { Box } from "../../../shared/types/box";
import { PANEL_WIDTH, type PanelPlacement, type Viewport, placePanel } from "./panel-placement";

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const PANEL_HEIGHT = 320;

function panelBox(placement: PanelPlacement, panelHeight = PANEL_HEIGHT): Box {
  const height = Math.min(panelHeight, placement.maxHeight);
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

  test("keeps a tall card off both Momen 2 lodging targets by letting it scroll", () => {
    // The footprints of the two rings on /perdin/baru at 1280×800: the "Tidak menginap di hotel"
    // radio and the lodging amount field, each with its outline and label.
    const radio: Box = { left: 320, top: 358, width: 160, height: 86 };
    const amount: Box = { left: 320, top: 433, width: 864, height: 108 };
    // An answer with three calculation rows and three citations.
    const tallCard = 590;

    const placement = placePanel({ x: 340, y: 430 }, VIEWPORT, tallCard, [radio, amount]);

    const box = panelBox(placement, tallCard);
    expect(overlaps(box, radio)).toBe(false);
    expect(overlaps(box, amount)).toBe(false);
  });

  test("covers as little as possible when no spot is free", () => {
    const everywhere: Box = { left: 0, top: 0, width: VIEWPORT.width, height: 720 };

    const placement = placePanel({ x: 100, y: 100 }, VIEWPORT, PANEL_HEIGHT, [everywhere]);

    expect(placement).toEqual({
      left: VIEWPORT.width - PANEL_WIDTH - 12,
      bottom: 12,
      maxHeight: 776,
    });
  });
});
