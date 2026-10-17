/** Asks the background for a screenshot of the sender tab's viewport, to cut an Area Crop from. */
export type CaptureViewportMessage = { type: "nemu:capture-viewport" };

export const CAPTURE_VIEWPORT_MESSAGE: CaptureViewportMessage = { type: "nemu:capture-viewport" };

export type CaptureViewportResult = { ok: true; dataUrl: string } | { ok: false };

export function isCaptureViewportMessage(message: unknown): message is CaptureViewportMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:capture-viewport"
  );
}

function isCaptureViewportResult(value: unknown): value is CaptureViewportResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === false) return true;
  return value.ok === true && "dataUrl" in value && typeof value.dataUrl === "string";
}

export function toCaptureViewportResult(value: unknown): CaptureViewportResult {
  return isCaptureViewportResult(value) ? value : { ok: false };
}
