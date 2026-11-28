import type { Rect } from "@nemu/ui/lib/nemu-placement";

/**
 * Where Chrome draws its microphone prompt, in page pixels. The prompt is browser UI over the top
 * left of the page, hanging from the "Use microphone?" chip at the left of the address bar, so Nemu
 * can't see it; it points at the measured place instead (ADR-0019). Measured on Chrome for macOS:
 * the prompt spans 126–447 px across, and its top button, "Izinkan saat mengunjungi situs", sits
 * 301 px below the window's top edge, 146 px from the left, 36 px tall. Edge puts it in the same
 * place.
 */
export const PROMPT_RIGHT = 447;
const BUTTON_LEFT = 146;
const BUTTON_TOP_IN_WINDOW = 301;
const BUTTON_HEIGHT = 36;
const MIN_TOP = 8;

/**
 * The top Izinkan button, widened to the prompt's right edge: the Nemu cursor rests just right of
 * it, outside the prompt where it can be seen, level with the button. The browser's bars above the
 * page (tabs, toolbar, bookmarks) are `outerHeight - innerHeight`; the prompt stays put while a
 * bookmarks bar pushes the page down.
 */
export function chromePromptAnchor(window: { outerHeight: number; innerHeight: number }): Rect {
  const bars = Math.max(0, window.outerHeight - window.innerHeight);
  return {
    left: BUTTON_LEFT,
    top: Math.max(MIN_TOP, BUTTON_TOP_IN_WINDOW - bars),
    width: PROMPT_RIGHT - BUTTON_LEFT,
    height: BUTTON_HEIGHT,
  };
}
