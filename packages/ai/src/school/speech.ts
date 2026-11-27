import type { SpeechSynthesis, SpokenWord, Transcript } from "@nemu/contracts/school";

import { fetchJson } from "../http.js";
import { base64ToBytes, bytesToBase64 } from "./llm.js";

/**
 * Speech for v2.2 (AI_TECHNICAL_PRD §7). Transcription runs as its own step so the bubble can show
 * what Nemu heard (F0-04). Synthesis returns the exact text it spoke plus word timings for the
 * highlight; with OpenRouter TTS the timings are estimated and the client rescales them.
 */

export type AudioInput = {
  base64: string;
  format: "wav" | "webm" | "ogg" | "mp3" | "m4a" | "flac";
};

export type Transcriber = (audio: AudioInput) => Promise<Transcript>;

/** Terms the recognizer should prefer. Never student names (they stay on the Nemu side). */
export const SCHOOL_GLOSSARY = [
  "AlurSekolah",
  "Nemu",
  "e-Rapor",
  "Ruang GTK",
  "Info GTK",
  "E-Kinerja",
  "SKP",
  "RHK",
  "KKM",
  "NIP",
  "UTS",
  "UAS",
  "remedial",
  "Rekap Nilai",
  "Simpan",
  "Ajukan",
  "Moodle",
  "kuis",
  "IPAS",
];

/** Javanese words teachers mix into commands (F0-2), so the recognizer keeps them as said. */
export const SPOKEN_JAVANESE = ["tulung", "isiake", "nilaine", "ora metu", "nggih", "piye"];

export type OpenRouterTranscriberConfig = {
  apiKey: string;
  model: string;
  zdr?: boolean;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
};

export function createOpenRouterTranscriber(config: OpenRouterTranscriberConfig): Transcriber {
  return async (audio) => {
    const response = (await fetchJson(
      "https://openrouter.ai/api/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          input_audio: { data: audio.base64, format: audio.format },
          language: "id",
          prompt: `Percakapan guru dengan asisten Nemu, kadang campur bahasa Jawa (${SPOKEN_JAVANESE.join(", ")}). Istilah: ${SCHOOL_GLOSSARY.join(", ")}.`,
          provider: { data_collection: "deny", ...(config.zdr ? { zdr: true } : {}) },
        }),
      },
      { fetchImplementation: config.fetchImplementation, timeoutMs: config.timeoutMs ?? 20_000 },
    )) as { text?: unknown };
    if (typeof response.text !== "string") throw new Error("Transcription response has no text");
    return { text: response.text.trim() };
  };
}

export type Synthesizer = (text: string) => Promise<SpeechSynthesis>;

/** Characters per second at 0.85× for Indonesian; only used to estimate word timings. */
const CHARS_PER_SECOND = 12.5;

/**
 * Estimates word timings from character counts, with pauses at commas (180 ms) and full stops
 * (300 ms) and ½ s between sentences. The client rescales by the real audio duration.
 */
export function estimateWordTimings(text: string): { words: SpokenWord[]; durationMs: number } {
  const words: SpokenWord[] = [];
  let offset = 0;
  for (const token of text.split(/\s+/u).filter(Boolean)) {
    const durationMs = Math.max(
      160,
      Math.round((token.replace(/[^\p{L}\p{N}]/gu, "").length / CHARS_PER_SECOND) * 1_000),
    );
    words.push({ text: token, offsetMs: offset, durationMs });
    offset += durationMs;
    if (/[.!?]$/u.test(token)) offset += 500;
    else if (/[.;:]$/u.test(token)) offset += 300;
    else if (token.endsWith(",")) offset += 180;
  }
  return { words, durationMs: offset };
}

export type OpenRouterSynthesizerConfig = {
  apiKey: string;
  model: string;
  voice: string;
  /** 0.85 by default (PRD §8). */
  speed?: number;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
};

/** TTS through OpenRouter (the chosen provider). It returns audio only, so timings are estimated. */
export function createOpenRouterSynthesizer(config: OpenRouterSynthesizerConfig): Synthesizer {
  return async (text) => {
    const fetchImplementation = config.fetchImplementation ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);
    try {
      const response = await fetchImplementation("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          input: text,
          voice: config.voice,
          speed: config.speed ?? 0.85,
          response_format: "mp3",
          provider: { data_collection: "deny" },
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Speech request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
      }
      const audio = new Uint8Array(await response.arrayBuffer());
      const { words, durationMs } = estimateWordTimings(text);
      return {
        audioBase64: bytesToBase64(audio),
        mimeType: response.headers.get("content-type") ?? "audio/mpeg",
        text,
        words,
        timing: "estimated",
        estimatedDurationMs: durationMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

/** Used when no TTS provider is configured: fails clearly; the client falls back to the OS voice. */
export function createUnconfiguredSynthesizer(): Synthesizer {
  return async () => {
    throw new Error(
      "Text-to-speech is not configured (set OPENROUTER_TTS_MODEL and OPENROUTER_TTS_VOICE); use the local voice.",
    );
  };
}

/** Text-only fallback for the client's local voice: same text, estimated timings, no audio. */
export function localVoicePlan(text: string): Omit<SpeechSynthesis, "audioBase64" | "mimeType"> {
  const { words, durationMs } = estimateWordTimings(text);
  return { text, words, timing: "estimated", estimatedDurationMs: durationMs };
}

/** Cache key for fixed phrases ("Silakan Ibu tekan Simpan.") so repeated speech costs nothing. */
export async function phraseCacheKey(
  model: string,
  voice: string,
  speed: number,
  text: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${model}|${voice}|${speed}|${text}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return bytesToBase64(digest).replace(
    /[+/=]/gu,
    (char) => ({ "+": "-", "/": "_", "=": "" })[char]!,
  );
}

export { base64ToBytes };
