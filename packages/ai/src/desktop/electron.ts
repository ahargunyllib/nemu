import type { WindowBounds } from "./reader.js";

/**
 * Screen capture with Electron's `desktopCapturer`, typed structurally so this package doesn't
 * depend on Electron. The desktop app passes its own `desktopCapturer` and `screen` modules.
 * The Nemu overlay must call `setContentProtection(true)` so it never appears in the capture.
 */

type NativeImageLike = {
  getSize(): { width: number; height: number };
  crop(rect: { x: number; y: number; width: number; height: number }): NativeImageLike;
  resize(options: {
    width?: number;
    height?: number;
    quality?: "good" | "better" | "best";
  }): NativeImageLike;
  toJPEG(quality: number): Uint8Array;
  isEmpty(): boolean;
};

type DisplayLike = { id: number; bounds: WindowBounds; scaleFactor: number };

export type ElectronCaptureDeps = {
  desktopCapturer: {
    getSources(options: {
      types: Array<"screen">;
      thumbnailSize: { width: number; height: number };
    }): Promise<Array<{ display_id: string; thumbnail: NativeImageLike }>>;
  };
  screen: { getDisplayMatching(rect: WindowBounds): DisplayLike };
};

/** Pure: the window's rectangle in the display thumbnail's pixels, clamped to the display. */
export function cropRect(
  window: WindowBounds,
  display: DisplayLike,
  thumbnail: { width: number; height: number },
) {
  const scaleX = thumbnail.width / display.bounds.width;
  const scaleY = thumbnail.height / display.bounds.height;
  const x = Math.max(0, Math.round((window.x - display.bounds.x) * scaleX));
  const y = Math.max(0, Math.round((window.y - display.bounds.y) * scaleY));
  return {
    x,
    y,
    width: Math.max(1, Math.min(thumbnail.width - x, Math.round(window.width * scaleX))),
    height: Math.max(1, Math.min(thumbnail.height - y, Math.round(window.height * scaleY))),
  };
}

export function createElectronCapture(deps: ElectronCaptureDeps) {
  return async (bounds: WindowBounds, maxSide: number): Promise<Uint8Array> => {
    const display = deps.screen.getDisplayMatching(bounds);
    const size = {
      width: Math.round(display.bounds.width * display.scaleFactor),
      height: Math.round(display.bounds.height * display.scaleFactor),
    };
    const sources = await deps.desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: size,
    });
    const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0];
    if (!source || source.thumbnail.isEmpty())
      throw new Error("Screen capture returned nothing (screen-recording permission?)");
    const cropped = source.thumbnail.crop(cropRect(bounds, display, source.thumbnail.getSize()));
    const { width, height } = cropped.getSize();
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const resized =
      scale < 1
        ? cropped.resize({
            width: Math.round(width * scale),
            height: Math.round(height * scale),
            quality: "good",
          })
        : cropped;
    return resized.toJPEG(80);
  };
}
