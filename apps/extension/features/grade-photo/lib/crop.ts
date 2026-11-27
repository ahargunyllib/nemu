/** A verification question's box: [x0, y0, x1, y1] on a 0–1000 scale of the photo. */
export type PhotoBox = readonly [number, number, number, number];

/** How much of the line around the cell to keep (0–1000 scale), so the name beside it shows. */
const PAD_X = 0.6;
const MAX_PAD_X = 60;
const PAD_Y = 0.35;
/** Never wider than this against its height, so even a long name cell reads as enlarged. */
const MAX_ASPECT = 3.2;
const OUTPUT_WIDTH = 640;

/** The cell's rectangle in the photo's pixels, padded, or null when it falls outside. */
export function cropRect(
  box: PhotoBox,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  const [x0, y0, x1, y1] = box;
  const padX = Math.min((x1 - x0) * PAD_X, MAX_PAD_X);
  const padY = (y1 - y0) * PAD_Y;
  const left = Math.max(0, ((x0 - padX) / 1000) * width);
  const right = Math.min(width, ((x1 + padX) / 1000) * width);
  let top = Math.max(0, ((y0 - padY) / 1000) * height);
  let bottom = Math.min(height, ((y1 + padY) / 1000) * height);
  if (right - left < 1 || bottom - top < 1) return null;
  const minHeight = (right - left) / MAX_ASPECT;
  if (bottom - top < minHeight) {
    const middle = (top + bottom) / 2;
    top = Math.max(0, middle - minHeight / 2);
    bottom = Math.min(height, top + minHeight);
  }
  return { left, top, width: right - left, height: bottom - top };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return btoa(binary);
}

/**
 * Background: W5's crops, each cell enlarged with a little of its line, as data URLs. Only the
 * crops reach the page, never the whole photo. Null for a question without a box, or when the
 * photo can't be drawn; the card then shows the question alone.
 */
export async function cropPhoto(
  photo: Blob,
  boxes: readonly (PhotoBox | null)[],
): Promise<(string | null)[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo);
  } catch {
    return boxes.map(() => null);
  }
  const crops = await Promise.all(
    boxes.map(async (box) => {
      const rect = box && cropRect(box, bitmap.width, bitmap.height);
      if (!rect) return null;
      const canvas = new OffscreenCanvas(
        OUTPUT_WIDTH,
        Math.round(rect.height * (OUTPUT_WIDTH / rect.width)),
      );
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(
        bitmap,
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      return `data:image/jpeg;base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
    }),
  );
  bitmap.close();
  return crops;
}
