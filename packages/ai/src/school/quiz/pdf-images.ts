import { bytesToBase64 } from "../llm.js";

/**
 * F4-03: the pictures a teacher's script carries, taken out of the PDF as they are, so a quiz
 * question gets the script's own image and never one Nemu draws or a model describes. The model
 * only says which picture belongs where (`script.ts`). Covers what word processors and browsers
 * write: Flate (raw RGB or grey, with or without PNG predictors) and DCT (JPEG) image XObjects,
 * on pages or inside forms. Anything else is skipped, and a question that needs it is asked.
 */

export type ScriptImage = {
  /** "gambar-1", in page order, as the model and the questions name it. */
  id: string;
  /** The page it is drawn on (1-based), or null when it isn't drawn on a page Nemu can see. */
  page: number | null;
  width: number;
  height: number;
  dataUrl: string;
};

type PdfObject = { dict: string; stream: Uint8Array | null };

const LATIN1 = new TextDecoder("latin1");

/** The text from `<<` at `start` to its matching `>>`. */
function balancedDict(text: string, start: number): string {
  let depth = 0;
  for (let at = start; at < text.length - 1; at += 1) {
    if (text[at] === "<" && text[at + 1] === "<") {
      depth += 1;
      at += 1;
    } else if (text[at] === ">" && text[at + 1] === ">") {
      depth -= 1;
      at += 1;
      if (depth === 0) return text.slice(start, at + 1);
    }
  }
  return text.slice(start);
}

/** Every `N 0 obj … endobj` with its dictionary and raw stream bytes (no object streams). */
function readObjects(bytes: Uint8Array): Map<number, PdfObject> {
  const text = LATIN1.decode(bytes);
  const objects = new Map<number, PdfObject>();
  const header = /(\d+)\s+(\d+)\s+obj\b/gu;
  for (let match = header.exec(text); match; match = header.exec(text)) {
    const number = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const end = text.indexOf("endobj", bodyStart);
    const body = text.slice(bodyStart, end < 0 ? undefined : end);
    const open = body.indexOf("<<");
    const dict = open >= 0 && body.slice(0, open).trim() === "" ? balancedDict(body, open) : body;
    let stream: Uint8Array | null = null;
    const streamAt = body.indexOf("stream", open >= 0 ? open + dict.length : 0);
    if (open >= 0 && streamAt >= 0 && body.slice(open + dict.length, streamAt).trim() === "") {
      let dataStart = bodyStart + streamAt + "stream".length;
      if (text[dataStart] === "\r") dataStart += 1;
      if (text[dataStart] === "\n") dataStart += 1;
      const stop = text.indexOf("endstream", dataStart);
      stream = bytes.subarray(dataStart, stop < 0 ? dataStart : stop);
    }
    objects.set(number, { dict, stream });
    header.lastIndex = end < 0 ? text.length : end;
  }
  // A /Length given as a reference is resolved now that every object is known.
  for (const object of objects.values()) {
    if (!object.stream) continue;
    const direct = object.dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/u);
    const indirect = object.dict.match(/\/Length\s+(\d+)\s+\d+\s+R/u);
    const length = direct
      ? Number(direct[1])
      : indirect
        ? Number(objects.get(Number(indirect[1]))?.dict.trim())
        : NaN;
    if (Number.isInteger(length) && length >= 0 && length <= object.stream.length)
      object.stream = object.stream.subarray(0, length);
  }
  return objects;
}

function numberEntry(dict: string, key: string): number | null {
  const value = Number(dict.match(new RegExp(`/${key}\\s+(\\d+)`, "u"))?.[1]);
  return Number.isFinite(value) ? value : null;
}

/** The `/Name N 0 R` pairs of a resource sub-dictionary (`/XObject << … >>`), direct or referenced. */
function namedRefs(dict: string, key: string, objects: Map<number, PdfObject>): number[] {
  const at = dict.search(new RegExp(`/${key}\\s*(<<|\\d+\\s+\\d+\\s+R)`, "u"));
  if (at < 0) return [];
  const rest = dict.slice(at + key.length + 1).trimStart();
  const inner = rest.startsWith("<<")
    ? balancedDict(rest, 0)
    : (objects.get(Number(rest.match(/^(\d+)/u)?.[1]))?.dict ?? "");
  return [...inner.matchAll(/\/[^\s/<>[\]]+\s+(\d+)\s+\d+\s+R/gu)].map((match) => Number(match[1]));
}

function resources(dict: string, objects: Map<number, PdfObject>): string {
  const at = dict.search(/\/Resources\s*(<<|\d+\s+\d+\s+R)/u);
  if (at < 0) return "";
  const rest = dict.slice(at + "/Resources".length).trimStart();
  return rest.startsWith("<<")
    ? balancedDict(rest, 0)
    : (objects.get(Number(rest.match(/^(\d+)/u)?.[1]))?.dict ?? "");
}

/** Page object numbers in reading order, following /Pages /Kids from the catalog. */
function pageOrder(objects: Map<number, PdfObject>): number[] {
  const root = [...objects.entries()].find(
    ([, object]) => /\/Type\s*\/Pages\b/u.test(object.dict) && !/\/Parent\s+\d+/u.test(object.dict),
  );
  if (!root) return [];
  const pages: number[] = [];
  const walk = (number: number, depth: number) => {
    const object = objects.get(number);
    if (!object || depth > 20) return;
    if (/\/Type\s*\/Page\b/u.test(object.dict)) return void pages.push(number);
    const kids = object.dict.match(/\/Kids\s*\[([^\]]*)\]/u)?.[1] ?? "";
    for (const kid of kids.matchAll(/(\d+)\s+\d+\s+R/gu)) walk(Number(kid[1]), depth + 1);
  };
  walk(root[0], 0);
  return pages;
}

async function run(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A PNG from rows that already carry a PNG filter byte each (`filtered`) or raw rows. */
export async function encodePng(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 1 | 3,
  filtered = false,
): Promise<Uint8Array> {
  const stride = width * channels;
  let rows = pixels;
  if (!filtered) {
    rows = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y += 1)
      rows.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, channels === 3 ? 2 : 0, 0, 0, 0], 8);
  const idat = await run(rows, new CompressionStream("deflate"));
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

function channelsOf(dict: string, objects: Map<number, PdfObject>): 1 | 3 | null {
  const space = dict.match(/\/ColorSpace\s*(\/\w+|\[[^\]]*\]|\d+\s+\d+\s+R)/u)?.[1] ?? "";
  if (/DeviceRGB|CalRGB/u.test(space)) return 3;
  if (/DeviceGray|CalGray/u.test(space)) return 1;
  const icc = space.match(/ICCBased\s+(\d+)\s+\d+\s+R/u);
  if (icc) {
    const n = numberEntry(objects.get(Number(icc[1]))?.dict ?? "", "N");
    return n === 3 ? 3 : n === 1 ? 1 : null;
  }
  const referenced = space.match(/^(\d+)\s+\d+\s+R$/u);
  if (referenced)
    return channelsOf(
      `/ColorSpace ${objects.get(Number(referenced[1]))?.dict.trim() ?? ""}`,
      objects,
    );
  return null;
}

async function imageData(object: PdfObject, objects: Map<number, PdfObject>) {
  const { dict, stream } = object;
  const width = numberEntry(dict, "Width");
  const height = numberEntry(dict, "Height");
  if (!stream || !width || !height) return null;
  const filter = dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/u)?.[1] ?? "";
  if (/DCTDecode/u.test(filter) && !/FlateDecode/u.test(filter))
    return { width, height, dataUrl: `data:image/jpeg;base64,${bytesToBase64(stream)}` };
  if (!/^\/?\[?\s*\/FlateDecode\s*\]?$/u.test(filter.trim())) return null;
  if (numberEntry(dict, "BitsPerComponent") !== 8 || /\/ImageMask\s+true/u.test(dict)) return null;
  const channels = channelsOf(dict, objects);
  if (!channels) return null;
  const raw = await run(stream, new DecompressionStream("deflate")).catch(() => null);
  if (!raw) return null;
  const predictor = numberEntry(dict, "Predictor") ?? 1;
  const filtered = predictor >= 10;
  const expected = (width * channels + (filtered ? 1 : 0)) * height;
  if (raw.length < expected) return null;
  const png = await encodePng(raw.subarray(0, expected), width, height, channels, filtered);
  return { width, height, dataUrl: `data:image/png;base64,${bytesToBase64(png)}` };
}

/** Image XObjects drawn on a page or in a form it draws, by object number, in resource order. */
function imagesOn(
  dict: string,
  objects: Map<number, PdfObject>,
  seen: Set<number>,
  depth = 0,
): number[] {
  const found: number[] = [];
  for (const ref of namedRefs(resources(dict, objects), "XObject", objects)) {
    if (seen.has(ref) || depth > 5) continue;
    seen.add(ref);
    const object = objects.get(ref);
    if (!object) continue;
    if (/\/Subtype\s*\/Image\b/u.test(object.dict)) found.push(ref);
    else if (/\/Subtype\s*\/Form\b/u.test(object.dict))
      found.push(...imagesOn(object.dict, objects, seen, depth + 1));
  }
  return found;
}

/** The pictures in a PDF, page by page; an image used only as another's mask is left out. */
export async function extractPdfImages(bytes: Uint8Array): Promise<ScriptImage[]> {
  const objects = readObjects(bytes);
  const masks = new Set(
    [...objects.values()].flatMap((object) =>
      [...object.dict.matchAll(/\/SMask\s+(\d+)\s+\d+\s+R/gu)].map((match) => Number(match[1])),
    ),
  );
  const placed: { ref: number; page: number | null }[] = [];
  const seen = new Set<number>();
  pageOrder(objects).forEach((pageRef, index) => {
    for (const ref of imagesOn(objects.get(pageRef)?.dict ?? "", objects, seen))
      placed.push({ ref, page: index + 1 });
  });
  for (const [ref, object] of objects)
    if (!seen.has(ref) && /\/Subtype\s*\/Image\b/u.test(object.dict))
      placed.push({ ref, page: null });

  const images: ScriptImage[] = [];
  for (const { ref, page } of placed) {
    if (masks.has(ref)) continue;
    const data = await imageData(objects.get(ref)!, objects);
    if (!data) continue;
    images.push({ id: `gambar-${images.length + 1}`, page, ...data });
  }
  return images;
}
