import type { ModelFormPhoto } from "../bpmn/form-photo.js";
import { base64ToBytes } from "../llm.js";

/**
 * Offline photo reading (`NEMU_RESPONDER=fixture`) for any BPMN form: a synthetic test photo
 * carries what a model would read from it as JSON in a PNG text chunk named `nemu-fixture`
 * (drawn by `packages/ai/scripts/f3-1-photo.py`). A photo without one reads as unreadable, so
 * offline Nemu asks for a new photo instead of inventing rows.
 */
export const FIXTURE_CHUNK = "nemu-fixture";

const UNREADABLE: ModelFormPhoto = { readable: false, key_field: null, header: [], rows: [] };

/** The `nemu-fixture` tEXt or (uncompressed) iTXt chunk of a PNG data URL, or null. */
export function pngFixtureText(dataUrl: string): string | null {
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) return null;
  const bytes = base64ToBytes(base64);
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "tEXt" || type === "iTXt") {
      const zero = data.indexOf(0);
      const keyword = new TextDecoder("latin1").decode(data.subarray(0, zero));
      if (keyword === FIXTURE_CHUNK) {
        if (type === "tEXt") return new TextDecoder("latin1").decode(data.subarray(zero + 1));
        // iTXt: keyword\0 compression-flag compression-method language\0 translated\0 text
        if (data[zero + 1] !== 0) return null;
        let at = zero + 3;
        at = data.indexOf(0, at) + 1;
        at = data.indexOf(0, at) + 1;
        return new TextDecoder().decode(data.subarray(at));
      }
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return null;
}

export function fixtureFormPhoto(dataUrl: string): ModelFormPhoto {
  const text = pngFixtureText(dataUrl);
  if (!text) return UNREADABLE;
  try {
    return JSON.parse(text) as ModelFormPhoto;
  } catch {
    return UNREADABLE;
  }
}
