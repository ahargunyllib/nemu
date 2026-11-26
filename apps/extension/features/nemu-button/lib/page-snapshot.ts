import type { ScreenSnapshot } from "@nemu/contracts/school";

const MAX_LINES = 200;
const MAX_LINE = 500;

/**
 * What the page shows, for "ini kenapa?": its title, address and visible text lines. Input values
 * are never read, and nothing at all while a password field is on the page. Only called on WS-03
 * sites, since the content script stops before mounting anywhere else.
 */
export function readPageSnapshot(document: Document, url: string): ScreenSnapshot {
  const base = {
    title: document.title.slice(0, 500),
    url: url.slice(0, 2_000),
    elements: [],
    screenshotBase64: null,
  };
  if (document.querySelector("input[type='password']")) {
    return { ...base, texts: [], blocked: true, blockedReason: "password_field" };
  }
  const lines = (document.body.innerText ?? document.body.textContent ?? "")
    .split("\n")
    .map((line) => line.trim().slice(0, MAX_LINE))
    .filter((line) => line.length > 0);
  return {
    ...base,
    texts: [...new Set(lines)].slice(0, MAX_LINES),
    blocked: false,
    blockedReason: null,
  };
}
