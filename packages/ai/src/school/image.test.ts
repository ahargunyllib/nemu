import assert from "node:assert/strict";
import test from "node:test";

import { imageMimeType, stripJpegMetadata } from "./image.js";

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

test("EXIF/XMP segments are removed and image data is kept byte for byte", () => {
  const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 1, 2, 3]); // "Exif" + GPS-ish bytes
  const quantization = segment(0xdb, [9, 9, 9]);
  const scan = [0xff, 0xda, 0, 4, 7, 7, 0xaa, 0xbb, 0xff, 0xd9];
  const jpeg = new Uint8Array([0xff, 0xd8, ...exif, ...quantization, ...scan]);
  const stripped = stripJpegMetadata(jpeg);
  assert.deepEqual([...stripped], [0xff, 0xd8, ...quantization, ...scan]);
  assert.equal(imageMimeType(stripped), "image/jpeg");
});

test("a non-JPEG or malformed file is returned unchanged", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  assert.equal(stripJpegMetadata(png), png);
  assert.equal(imageMimeType(png), "image/png");
  const broken = new Uint8Array([0xff, 0xd8, 0x00, 0x01]);
  assert.equal(stripJpegMetadata(broken), broken);
});
