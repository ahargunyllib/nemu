import type { Box } from "../../../shared/types/box";
import type { Viewport } from "./panel-placement";

/** The page's cards (such as Beranda's Tugas berikutnya) and every element Nemu can point at. */
const CONTENT = '[data-slot="card"], [data-nemu-id]';

/**
 * The boxes of the page's content on screen, which an Answer Card with no target to sit beside
 * keeps off, so it goes into empty space. Nemu's own overlay is in a shadow root, out of reach.
 */
export function pageContentBoxes(viewport: Viewport, root: ParentNode = document): Box[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CONTENT), (element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top, width, height };
  }).filter(
    (box) =>
      box.width > 0 &&
      box.height > 0 &&
      box.left < viewport.width &&
      box.top < viewport.height &&
      box.left + box.width > 0 &&
      box.top + box.height > 0,
  );
}
