import { describe, expect, test } from "vite-plus/test";

import { bytesToBase64, encodeWav, mixToMono, TRANSCRIBE_SAMPLE_RATE } from "./wav";

describe("encodeWav", () => {
  test("writes a 16 kHz mono 16-bit PCM file with clipped samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), TRANSCRIBE_SAMPLE_RATE);
    const view = new DataView(wav.buffer);
    const text = (offset: number) => String.fromCharCode(...wav.subarray(offset, offset + 4));
    expect([text(0), text(8), text(12), text(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([44, 46, 48, 50].map((offset) => view.getInt16(offset, true))).toEqual([
      0, 32_767, -32_768, 32_767,
    ]);
  });
});

describe("mixToMono", () => {
  test("averages a stereo recording", () => {
    expect([...mixToMono([new Float32Array([1, 0]), new Float32Array([0, -1])])]).toEqual([
      0.5, -0.5,
    ]);
  });
});

describe("bytesToBase64", () => {
  test("encodes more bytes than one chunk", () => {
    const bytes = new Uint8Array(70_000).fill(65);
    expect(atob(bytesToBase64(bytes))).toBe("A".repeat(70_000));
  });
});
