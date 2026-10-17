import { describe, expect, test } from "vite-plus/test";

import { cropRegion, isUsableSelection, MAX_CROP_SIDE, selectionBox } from "./area-crop";

describe("selectionBox", () => {
  test("spans the drag in any direction", () => {
    const expected = { left: 100, top: 200, width: 300, height: 80 };

    expect(selectionBox({ x: 100, y: 200 }, { x: 400, y: 280 })).toEqual(expected);
    expect(selectionBox({ x: 400, y: 280 }, { x: 100, y: 200 })).toEqual(expected);
  });

  test("treats a click or a thin sliver as no selection", () => {
    expect(isUsableSelection(selectionBox({ x: 10, y: 10 }, { x: 10, y: 10 }))).toBe(false);
    expect(isUsableSelection(selectionBox({ x: 10, y: 10 }, { x: 300, y: 13 }))).toBe(false);
    expect(isUsableSelection(selectionBox({ x: 10, y: 10 }, { x: 300, y: 90 }))).toBe(true);
  });
});

describe("cropRegion", () => {
  const viewport = { width: 1280, height: 800 };

  test("cuts only the selected area out of a high-density screenshot", () => {
    const region = cropRegion({ left: 100, top: 200, width: 300, height: 80 }, viewport, {
      width: 2560,
      height: 1600,
    });

    expect(region).toEqual({
      source: { left: 200, top: 400, width: 600, height: 160 },
      output: { width: 600, height: 160 },
    });
  });

  test("keeps the cut inside the screenshot when the box runs off the viewport", () => {
    const region = cropRegion(
      { left: 1200, top: -20, width: 200, height: 100 },
      viewport,
      viewport,
    );

    expect(region.source).toEqual({ left: 1200, top: 0, width: 80, height: 80 });
  });

  test("scales a large selection down to the longest-side limit, keeping its shape", () => {
    const region = cropRegion({ left: 0, top: 0, width: 1280, height: 800 }, viewport, {
      width: 2560,
      height: 1600,
    });

    expect(region.output).toEqual({ width: MAX_CROP_SIDE, height: 800 });
  });
});
