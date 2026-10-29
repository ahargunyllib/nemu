// @vitest-environment happy-dom
import { describe, expect, test } from "vite-plus/test";

import {
  completesStep,
  highlightFootprint,
  labelSide,
  missingTargetWarning,
} from "./highlight-targets";

const VIEWPORT_WIDTH = 1280;

describe("labelSide", () => {
  test("puts the label to the right of a target with room beside it", () => {
    const radio = { left: 328, top: 304, width: 16, height: 16 };

    expect(labelSide(radio, VIEWPORT_WIDTH)).toBe("right");
  });

  test("falls back to the outline's top-right edge at the viewport's right edge", () => {
    const kirim = { left: 1120, top: 716, width: 56, height: 36 };

    expect(labelSide(kirim, VIEWPORT_WIDTH)).toBe("top");
  });

  test("falls back to the outline's bottom-right edge near the top of the viewport", () => {
    const menu = { left: 1120, top: 8, width: 56, height: 36 };

    expect(labelSide(menu, VIEWPORT_WIDTH)).toBe("bottom");
  });
});

describe("highlightFootprint", () => {
  test("covers the outline and the label to its right, level with the outline's top", () => {
    const radio = { left: 328, top: 304, width: 16, height: 16 };

    expect(highlightFootprint(radio, VIEWPORT_WIDTH)).toEqual({
      left: 324,
      top: 300,
      width: 272,
      height: 26,
    });
  });

  test("covers the label growing left along the top edge of a target at the right edge", () => {
    const kirim = { left: 1120, top: 716, width: 56, height: 36 };

    expect(highlightFootprint(kirim, VIEWPORT_WIDTH)).toEqual({
      left: 928,
      top: 694,
      width: 252,
      height: 62,
    });
  });

  test("covers the label below a target at the top-right corner", () => {
    const menu = { left: 1120, top: 8, width: 56, height: 36 };

    expect(highlightFootprint(menu, VIEWPORT_WIDTH)).toEqual({
      left: 928,
      top: 4,
      width: 252,
      height: 62,
    });
  });
});

describe("missingTargetWarning", () => {
  test("names the target by its label, without its nemu_id", () => {
    const warning = missingTargetWarning({
      type: "highlight",
      target: "tab-biaya",
      level: "arahkan",
      label: "Periksa ini",
    });

    expect(warning).toBe('Nemu tidak menemukan "Periksa ini" di halaman ini.');
  });
});

describe("completesStep", () => {
  function field(html: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    return wrapper.firstElementChild as HTMLElement;
  }

  test("waits for a change in an editable field, not a click into it", () => {
    const input = field("<input />");

    expect(completesStep(new Event("click"), input)).toBe(false);
    expect(completesStep(new Event("change"), input)).toBe(true);
  });

  test("takes a click on a read-only field as checking it", () => {
    expect(completesStep(new Event("click"), field("<input readonly />"))).toBe(true);
  });
});
