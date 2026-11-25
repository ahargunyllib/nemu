/**
 * Privacy for photos (UU PDP, AI_TECHNICAL_PRD §10): drop JPEG metadata segments (EXIF with GPS,
 * XMP, IPTC, comments) before a photo is stored or sent to a model. Pixels are untouched. Other
 * formats pass through; PNG carries no GPS by default.
 */

const STRIPPED_MARKERS = new Set([
  0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef, 0xfe,
]);

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (!isJpeg(bytes)) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let reachedScan = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return bytes; // Not a marker where one must be: leave the file alone.
    const marker = bytes[offset + 1]!;
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset)); // Start of scan: the rest is image data.
      reachedScan = true;
      break;
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return bytes;
    if (!STRIPPED_MARKERS.has(marker)) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (!reachedScan) return bytes; // Truncated or unusual file: don't guess, leave it alone.
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

export function imageMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (isJpeg(bytes)) return "image/jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP")
    return "image/webp";
  return null;
}
