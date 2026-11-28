import { cursorPoint } from "@nemu/ui/lib/nemu-placement";
import { describe, expect, test } from "vite-plus/test";

import { chromePromptAnchor, PROMPT_RIGHT } from "./permission-prompt";

// Measured from Chrome 1xx on macOS: a 1280 × 800 window whose tabs and toolbar take 87 px shows
// the prompt's top button ("Izinkan saat mengunjungi situs") 214–250 px down the page.
const NO_BOOKMARKS = { outerHeight: 800, innerHeight: 713 };
const VIEWPORT = { width: 1280, height: 713 };

describe("chromePromptAnchor", () => {
  test("covers the top Izinkan button, out to the prompt's right edge", () => {
    expect(chromePromptAnchor(NO_BOOKMARKS)).toEqual({
      left: 146,
      top: 214,
      width: 301,
      height: 36,
    });
  });

  test("the Nemu cursor rests just right of Chrome's prompt, level with Izinkan", () => {
    const point = cursorPoint(chromePromptAnchor(NO_BOOKMARKS), VIEWPORT);
    expect(point.x).toBeGreaterThan(PROMPT_RIGHT);
    expect(point.x).toBeLessThan(PROMPT_RIGHT + 30);
    expect(point.y).toBe(232);
  });

  test("a bookmarks bar moves the page down under a prompt that stays put", () => {
    expect(chromePromptAnchor({ outerHeight: 800, innerHeight: 685 }).top).toBe(186);
  });

  test("with no browser bar (full screen) it stays inside the window", () => {
    expect(chromePromptAnchor({ outerHeight: 800, innerHeight: 800 }).top).toBeGreaterThanOrEqual(
      8,
    );
  });
});
