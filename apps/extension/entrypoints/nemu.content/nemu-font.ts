// The content script is built as a library, so the woff2 files arrive inlined as data URLs.
import fontFaces from "@fontsource-variable/plus-jakarta-sans/index.css?inline";

const STYLE_ID = "nemu-font";

/**
 * Declares Plus Jakarta Sans on the page. Chromium ignores `@font-face` inside a shadow root, but
 * faces declared on the document reach it, so the Nemu overlay's font has to be loaded out here.
 */
export function loadNemuFont() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = fontFaces;
  document.head.append(style);
}
