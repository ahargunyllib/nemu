import { browser } from "wxt/browser";

import type { Box } from "../../../shared/types/box";
import { cropScreenshot } from "../lib/area-crop";
import { CAPTURE_VIEWPORT_MESSAGE, toCaptureViewportResult } from "../lib/capture-message";

/**
 * Screenshots the viewport through the background (only it can) and cuts the selection out of
 * it. The screenshot never leaves the tab; only the cut-out goes with the prompt.
 */
export async function captureAreaCrop(selection: Box): Promise<string> {
  const result = toCaptureViewportResult(
    await browser.runtime.sendMessage(CAPTURE_VIEWPORT_MESSAGE).catch(() => undefined),
  );
  if (!result.ok) throw new Error("The background could not capture the viewport");
  return cropScreenshot(result.dataUrl, selection);
}
