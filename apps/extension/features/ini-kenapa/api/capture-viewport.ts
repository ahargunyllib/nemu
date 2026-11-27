import { browser } from "wxt/browser";

const MAX_WIDTH = 1280;
const QUALITY = 0.7;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

/** A JPEG no wider than 1280 px, so a HiDPI screen doesn't send four times the pixels. */
async function shrink(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width <= MAX_WIDTH) {
    bitmap.close();
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
  const scale = MAX_WIDTH / bitmap.width;
  const canvas = new OffscreenCanvas(MAX_WIDTH, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY });
  return toBase64(new Uint8Array(await jpeg.arrayBuffer()));
}

/**
 * Background: the visible part of the teacher's tab as a JPEG (base64, no data: prefix), for
 * helpExplain. Only the viewport, only the tab that asked, and only when it is the one showing.
 * Null when Chrome refuses: `captureVisibleTab` needs `<all_urls>` or an `activeTab` grant
 * (ADR-0004), which a known site's host permission doesn't give, so F2 then runs on the page text.
 */
export async function captureViewport(tab: { id?: number; windowId?: number } | undefined) {
  if (tab?.id === undefined || tab.windowId === undefined) return null;
  try {
    const [active] = await browser.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id) return null;
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: Math.round(QUALITY * 100),
    });
    return await shrink(dataUrl);
  } catch (error) {
    console.info("[nemu] no screenshot for ini kenapa", error);
    return null;
  }
}
