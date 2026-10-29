/** Asks the background for a screenshot of the sender tab's viewport, to cut an Area Crop from. */
export type CaptureViewportMessage = { type: "nemu:capture-viewport" };

export const CAPTURE_VIEWPORT_MESSAGE: CaptureViewportMessage = { type: "nemu:capture-viewport" };

/**
 * `no-tab-access`: the tab has no `activeTab` grant, because the toolbar icon or the shortcut
 * hasn't fired the action on it (ADR-0004).
 */
export type CaptureViewportResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason?: "no-tab-access" };

export function isCaptureViewportMessage(message: unknown): message is CaptureViewportMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:capture-viewport"
  );
}

/** Chrome's `captureVisibleTab` error when the tab has neither `<all_urls>` nor an `activeTab` grant. */
const NO_TAB_ACCESS = /activeTab|<all_urls>/;

/** What the background answers when `captureVisibleTab` throws `error`. */
export function toCaptureViewportFailure(error: unknown): CaptureViewportResult {
  return error instanceof Error && NO_TAB_ACCESS.test(error.message)
    ? { ok: false, reason: "no-tab-access" }
    : { ok: false };
}

function isCaptureViewportResult(value: unknown): value is CaptureViewportResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === false) return true;
  return value.ok === true && "dataUrl" in value && typeof value.dataUrl === "string";
}

export function toCaptureViewportResult(value: unknown): CaptureViewportResult {
  return isCaptureViewportResult(value) ? value : { ok: false };
}
