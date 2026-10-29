import { describe, expect, test } from "vite-plus/test";

import type { Box } from "../../../shared/types/box";
import { atCardCorner, MASCOT_SIZE } from "../../mascot/lib/mascot-position";
import {
  PANEL_WIDTH,
  type PanelPlacement,
  type Viewport,
  panelBox,
  placePanel,
} from "./panel-placement";

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const PANEL_HEIGHT = 320;

/** The panel's box on screen, at its measured height or shrunk to its room. */
function boxAt(placement: PanelPlacement, panelHeight = PANEL_HEIGHT): Box {
  return panelBox(placement, panelHeight, VIEWPORT);
}

/** The mascot sitting on the panel's top-left corner, as it does while a step is highlighted. */
function mascotAt(placement: PanelPlacement, panelHeight = PANEL_HEIGHT): Box {
  const { x, y } = atCardCorner(boxAt(placement, panelHeight));
  return { left: x, top: y, width: MASCOT_SIZE, height: MASCOT_SIZE };
}

function overlaps(a: Box, b: Box) {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

function inside(box: Box, viewport = VIEWPORT) {
  return (
    box.left >= 0 &&
    box.top >= 0 &&
    box.left + box.width <= viewport.width &&
    box.top + box.height <= viewport.height
  );
}

describe("placePanel at a highlighted target", () => {
  // Footprints (element, outline, and label) of form fields on /perdin/baru at 1280×800. Their
  // labels sit on the outline's top-right edge, since a full-width field leaves no room beside it.
  const jenisPerjalanan: Box = { left: 282, top: 279, width: 948, height: 80 };
  const kotaTujuan: Box = { left: 282, top: 352, width: 948, height: 62 };
  const suratTugas: Box = { left: 286, top: 448, width: 940, height: 36 };
  const nominalPenginapan: Box = { left: 282, top: 534, width: 948, height: 66 };
  const uangHarian: Box = { left: 286, top: 659, width: 940, height: 36 };

  test("sits just above the target, its right end level with the target's", () => {
    const placement = placePanel({ target: jenisPerjalanan }, VIEWPORT, 220, [kotaTujuan]);
    const box = boxAt(placement, 220);

    expect(box.top + box.height).toBeLessThanOrEqual(jenisPerjalanan.top);
    expect(jenisPerjalanan.top - (box.top + box.height)).toBeLessThanOrEqual(12);
    expect(box.left + PANEL_WIDTH).toBe(jenisPerjalanan.left + jenisPerjalanan.width);
    expect(overlaps(box, jenisPerjalanan)).toBe(false);
    expect(overlaps(box, kotaTujuan)).toBe(false);
  });

  test("covers only the rows above the lodging amount, never the amount or the next field", () => {
    const placement = placePanel({ target: nominalPenginapan }, VIEWPORT, 360, [uangHarian]);
    const box = boxAt(placement, 360);

    expect(box.height).toBe(360);
    expect(box.top + box.height).toBeLessThanOrEqual(nominalPenginapan.top);
    expect(overlaps(box, nominalPenginapan)).toBe(false);
    expect(overlaps(box, uangHarian)).toBe(false);
  });

  test("shows the whole Momen 1 card, mascot included, without covering Kota tujuan (#164)", () => {
    const card = 300;

    const placement = placePanel({ target: kotaTujuan }, VIEWPORT, card, [suratTugas]);

    const box = boxAt(placement, card);
    expect(box.height).toBe(card);
    expect(inside(box)).toBe(true);
    expect(inside(mascotAt(placement, card))).toBe(true);
    expect(overlaps(box, kotaTujuan)).toBe(false);
    expect(overlaps(box, suratTugas)).toBe(false);
  });

  test("goes below the target when there is no room above it, the mascot clear of it too", () => {
    const nearTop: Box = { left: 282, top: 60, width: 948, height: 60 };

    const placement = placePanel({ target: nearTop }, VIEWPORT, PANEL_HEIGHT, []);

    expect(boxAt(placement).top).toBeGreaterThanOrEqual(nearTop.top + nearTop.height);
    expect(overlaps(mascotAt(placement), nearTop)).toBe(false);
  });

  test("goes beside a target that fills the height, the mascot clear of it", () => {
    const tall: Box = { left: 300, top: 40, width: 400, height: 720 };

    const placement = placePanel({ target: tall }, VIEWPORT, PANEL_HEIGHT, []);

    expect(boxAt(placement).left).toBeGreaterThanOrEqual(tall.left + tall.width);
    expect(mascotAt(placement).top).toBe(tall.top);
    expect(overlaps(mascotAt(placement), tall)).toBe(false);
  });

  test("goes below when the next field to fill sits right above the target", () => {
    const next: Box = { left: 282, top: 200, width: 948, height: 60 };
    const target: Box = { left: 282, top: 270, width: 948, height: 60 };

    const placement = placePanel({ target }, VIEWPORT, 200, [next]);

    const box = boxAt(placement, 200);
    expect(box.top).toBeGreaterThan(target.top + target.height);
    expect(overlaps(box, next)).toBe(false);
  });

  test("shrinks a card too tall for any side to scroll, rather than covering the target", () => {
    const placement = placePanel({ target: kotaTujuan }, VIEWPORT, 600, []);

    const box = boxAt(placement, 600);
    expect(box.height).toBeLessThan(600);
    expect(overlaps(box, kotaTujuan)).toBe(false);
  });
});

describe("placePanel with no target", () => {
  test("opens below the cursor in the top half and above it in the bottom half", () => {
    expect(placePanel({ cursor: { x: 100, y: 100 } }, VIEWPORT, PANEL_HEIGHT, [])).toEqual({
      left: 112,
      top: 112,
      maxHeight: 676,
    });
    expect(placePanel({ cursor: { x: 100, y: 700 } }, VIEWPORT, PANEL_HEIGHT, [])).toEqual({
      left: 112,
      bottom: 112,
      maxHeight: 676,
    });
  });

  test("keeps a panel wider than PANEL_WIDTH, such as one holding the Composer, on screen", () => {
    const width = PANEL_WIDTH + 40;

    const placement = placePanel(
      { cursor: { x: 1270, y: 100 } },
      VIEWPORT,
      PANEL_HEIGHT,
      [],
      width,
    );

    expect(placement.left).toBe(VIEWPORT.width - width - 12);
  });

  test("moves into empty space instead of covering Beranda's Tugas berikutnya", () => {
    // Beranda at 1280×800: the top bar, Proses Favorit, Tugas berikutnya, and Kinerja Saya.
    const content: Box[] = [
      { left: 232, top: 0, width: 1048, height: 56 },
      { left: 256, top: 155, width: 1000, height: 117 },
      { left: 256, top: 295, width: 600, height: 181 },
      { left: 862, top: 295, width: 394, height: 260 },
    ];

    const placement = placePanel({ cursor: { x: 640, y: 290 } }, VIEWPORT, 210, content);

    const box = boxAt(placement, 210);
    for (const area of content) expect(overlaps(box, area)).toBe(false);
  });

  test("covers as little as possible when no spot is free", () => {
    const everywhere: Box = { left: 0, top: 0, width: VIEWPORT.width, height: 720 };

    const placement = placePanel({ cursor: { x: 100, y: 100 } }, VIEWPORT, PANEL_HEIGHT, [
      everywhere,
    ]);

    expect(placement).toEqual({
      left: VIEWPORT.width - PANEL_WIDTH - 12,
      bottom: 12,
      maxHeight: 776,
    });
  });
});
