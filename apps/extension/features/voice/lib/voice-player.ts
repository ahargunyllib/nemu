import type { SpeechSynthesis, SpokenWord } from "@nemu/contracts/school";

import { estimateWords, rescaleWords, wordIndexAt } from "./word-timing";

/** The local voice's pace (docs/school-ai.md), and how much slower "pelan" makes either voice. */
const LOCAL_RATE = 0.85;
const SLOW_FACTOR = 0.8;
const TICK_MS = 50;

export type Playback = { pause(): void; resume(): void; stop(): void };

type PlayOptions = {
  slow: boolean;
  /** The index of the word being spoken, or -1; called when it changes. */
  onWord: (index: number) => void;
  onEnd: () => void;
};

/** What to speak when `speechSynthesize` can't be reached: the local voice with estimated words. */
export function localSpeech(text: string): SpeechSynthesis {
  const { words, durationMs } = estimateWords(text);
  return {
    audioBase64: "",
    mimeType: "",
    text,
    words,
    timing: "estimated",
    estimatedDurationMs: durationMs,
  };
}

function reportChanges(onWord: (index: number) => void) {
  let last = -2;
  return (index: number) => {
    if (index === last) return;
    last = index;
    onWord(index);
  };
}

/** The local `id-ID` voice at 0.85× (Windows: Microsoft Andika), highlighted by the clock. */
function speakLocally(speech: SpeechSynthesis, { slow, onWord, onEnd }: PlayOptions): Playback {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(speech.text);
  utterance.lang = "id-ID";
  utterance.rate = LOCAL_RATE * (slow ? SLOW_FACTOR : 1);
  utterance.voice =
    synth.getVoices().find((voice) => voice.lang.replace("_", "-").startsWith("id")) ?? null;
  synth.speak(utterance);

  // The timings assume 0.85×; "pelan" stretches them by the same factor as the voice.
  const words: SpokenWord[] = slow ? rescaleWords(speech.words, 1, 1 / SLOW_FACTOR) : speech.words;
  const end = words.reduce((max, word) => Math.max(max, word.offsetMs + word.durationMs), 0);
  const report = reportChanges(onWord);
  let elapsed = 0;
  let last = performance.now();
  let paused = false;
  const timer = setInterval(() => {
    const now = performance.now();
    if (!paused) elapsed += now - last;
    last = now;
    report(wordIndexAt(words, elapsed));
    if (elapsed >= end) {
      clearInterval(timer);
      onEnd();
    }
  }, TICK_MS);

  return {
    pause() {
      paused = true;
      synth.pause();
    },
    resume() {
      paused = false;
      synth.resume();
    },
    stop() {
      clearInterval(timer);
      synth.cancel();
    },
  };
}

/**
 * The Nemu Service's audio, highlighted by its own clock: estimated timings are rescaled to the
 * real length once it loads. If the page refuses to play it, the local voice takes over.
 */
function playAudio(speech: SpeechSynthesis, options: PlayOptions): Playback {
  const audio = new Audio(`data:${speech.mimeType};base64,${speech.audioBase64}`);
  audio.playbackRate = options.slow ? SLOW_FACTOR : 1;
  let words = speech.words;
  let fallback: Playback | null = null;
  const report = reportChanges(options.onWord);
  const timer = setInterval(() => report(wordIndexAt(words, audio.currentTime * 1000)), TICK_MS);

  audio.addEventListener("loadedmetadata", () => {
    if (speech.timing === "estimated")
      words = rescaleWords(speech.words, speech.estimatedDurationMs, audio.duration * 1000);
  });
  audio.addEventListener("ended", () => {
    clearInterval(timer);
    report(-1);
    options.onEnd();
  });
  audio.play().catch(() => {
    clearInterval(timer);
    fallback = speakLocally(speech, options);
  });

  return {
    pause: () => (fallback ? fallback.pause() : audio.pause()),
    resume: () => (fallback ? fallback.resume() : void audio.play().catch(() => undefined)),
    stop() {
      clearInterval(timer);
      audio.pause();
      fallback?.stop();
    },
  };
}

/** Speaks Nemu's sentence (F0-05): the service's audio, or the local voice when it sent none. */
export function playSpeech(speech: SpeechSynthesis, options: PlayOptions): Playback {
  return speech.audioBase64 ? playAudio(speech, options) : speakLocally(speech, options);
}
