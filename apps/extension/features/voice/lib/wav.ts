/** What `speechTranscribe` expects (docs/school-ai.md): 16 kHz mono. */
export const TRANSCRIBE_SAMPLE_RATE = 16_000;

/** Averages the channels of a recording into one. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const [first] = channels;
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const mono = new Float32Array(first.length);
  for (const channel of channels)
    for (let i = 0; i < mono.length; i++) mono[i]! += (channel[i] ?? 0) / channels.length;
  return mono;
}

/** 16-bit PCM WAV of mono samples in [-1, 1]; louder samples are clipped. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (const [i, char] of [...text].entries()) view.setUint8(offset + i, char.charCodeAt(0));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (const [i, sample] of samples.entries()) {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
