import type { SpokenWord } from "@nemu/contracts/school";

/** `speechSynthesize` takes at most this many characters (F0-05). */
const MAX_SPOKEN_CHARS = 300;

/**
 * The sentence Nemu speaks for a bubble: its first sentence, cut at a word under the synthesis
 * limit. The rest of the bubble is read, not spoken.
 */
export function mainSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/u);
  const sentence = end === -1 ? trimmed : trimmed.slice(0, end + 1);
  if (sentence.length <= MAX_SPOKEN_CHARS) return sentence;
  const cut = sentence.slice(0, MAX_SPOKEN_CHARS);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() || cut;
}

/**
 * Estimated timings assume a duration the real audio never quite has, so scale every word by the
 * real length once the audio loads (docs/school-ai.md, Speech).
 */
export function rescaleWords(
  words: readonly SpokenWord[],
  estimatedDurationMs: number,
  actualDurationMs: number,
): SpokenWord[] {
  if (!(estimatedDurationMs > 0) || !(actualDurationMs > 0) || !Number.isFinite(actualDurationMs))
    return [...words];
  const factor = actualDurationMs / estimatedDurationMs;
  return words.map((word) => ({
    text: word.text,
    offsetMs: word.offsetMs * factor,
    durationMs: word.durationMs * factor,
  }));
}

/**
 * The word to highlight at `elapsedMs`: the last one that has started, kept through the pause after
 * it; -1 before the first word and after the last one ends.
 */
export function wordIndexAt(words: readonly SpokenWord[], elapsedMs: number): number {
  const last = words.at(-1);
  if (!last || elapsedMs >= last.offsetMs + last.durationMs) return -1;
  let index = -1;
  for (const [i, word] of words.entries()) {
    if (word.offsetMs > elapsedMs) break;
    index = i;
  }
  return index;
}

/** Characters per second of the local voice at 0.85×; matches the Nemu Service's estimate. */
const CHARS_PER_SECOND = 12.5;

/**
 * Timings for when `speechSynthesize` can't be reached: one word after another at the local
 * voice's pace, with the pause after a comma or full stop.
 */
export function estimateWords(text: string): { words: SpokenWord[]; durationMs: number } {
  const words: SpokenWord[] = [];
  let offset = 0;
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const durationMs = (word.length / CHARS_PER_SECOND) * 1000;
    words.push({ text: word, offsetMs: offset, durationMs });
    offset += durationMs + (/[.!?]$/u.test(word) ? 300 : /[,;:]$/u.test(word) ? 180 : 80);
  }
  return { words, durationMs: offset };
}
