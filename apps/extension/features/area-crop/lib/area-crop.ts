import type { Box } from "../../../shared/types/box";

export type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** A drag smaller than this on either side is a stray click, not a selection. */
export const MIN_SELECTION_SIZE = 8;

/** The longest side of a sent Area Crop, so a big selection stays well under the request limit. */
export const MAX_CROP_SIDE = 1_280;

/** The box between where the drag started and where the pointer is now, in any direction. */
export function selectionBox(start: Point, end: Point): Box {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function isUsableSelection(box: Box): boolean {
  return box.width >= MIN_SELECTION_SIZE && box.height >= MIN_SELECTION_SIZE;
}

export type CropRegion = {
  /** The selection in the screenshot's pixels, clamped to the screenshot. */
  source: Box;
  /** The size the Area Crop is drawn at. */
  output: Size;
};

/**
 * Maps a selection in viewport (CSS) pixels onto a viewport screenshot, which the browser takes
 * at device pixels, and scales it down so its longest side is at most `MAX_CROP_SIDE`.
 */
export function cropRegion(selection: Box, viewport: Size, screenshot: Size): CropRegion {
  const scaleX = screenshot.width / viewport.width;
  const scaleY = screenshot.height / viewport.height;
  const left = clamp(Math.round(selection.left * scaleX), 0, screenshot.width);
  const top = clamp(Math.round(selection.top * scaleY), 0, screenshot.height);
  const right = clamp(Math.round((selection.left + selection.width) * scaleX), 0, screenshot.width);
  const bottom = clamp(
    Math.round((selection.top + selection.height) * scaleY),
    0,
    screenshot.height,
  );
  const source = { left, top, width: right - left, height: bottom - top };
  const shrink = Math.min(1, MAX_CROP_SIDE / Math.max(source.width, source.height, 1));

  return {
    source,
    output: {
      width: Math.max(1, Math.round(source.width * shrink)),
      height: Math.max(1, Math.round(source.height * shrink)),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Cuts the selection out of a viewport screenshot as a PNG data URL: the Area Crop. */
export async function cropScreenshot(screenshotUrl: string, selection: Box): Promise<string> {
  const image = new Image();
  image.src = screenshotUrl;
  await image.decode();

  const { source, output } = cropRegion(
    selection,
    { width: window.innerWidth, height: window.innerHeight },
    { width: image.naturalWidth, height: image.naturalHeight },
  );
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas to crop the screenshot");
  context.drawImage(
    image,
    source.left,
    source.top,
    source.width,
    source.height,
    0,
    0,
    output.width,
    output.height,
  );
  return canvas.toDataURL("image/png");
}
