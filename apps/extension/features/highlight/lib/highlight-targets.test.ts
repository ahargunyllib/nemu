import { describe, expect, test } from "vite-plus/test";

import { highlightFootprint } from "./highlight-targets";

const VIEWPORT_WIDTH = 1280;

describe("highlightFootprint", () => {
  test("covers the label growing right from a small target such as a radio", () => {
    const radio = { left: 328, top: 304, width: 16, height: 16 };

    expect(highlightFootprint(radio, VIEWPORT_WIDTH)).toEqual({
      left: 324,
      top: 272,
      width: 200,
      height: 80,
    });
  });

  test("covers the label growing left from a small target at the viewport's right edge", () => {
    const kirim = { left: 1120, top: 716, width: 56, height: 36 };

    expect(highlightFootprint(kirim, VIEWPORT_WIDTH)).toEqual({
      left: 980,
      top: 684,
      width: 200,
      height: 100,
    });
  });
});
