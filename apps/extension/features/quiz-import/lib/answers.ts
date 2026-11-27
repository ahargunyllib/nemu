import type { QuizScriptQuestion } from "@nemu/contracts/quiz";
import type { NemuChoice } from "@nemu/ui/lib/nemu-display";

/**
 * F4-03's questions about the script (#210), asked the way F1 asks about a photo: Kartu Pilih with
 * the options the reading gave, never pre-selected, or her own typed or spoken words.
 */

/** Her typed or spoken answer to a question about the script. */
export function answerFrom(question: QuizScriptQuestion, words: string): string | null {
  // Her own words for a question or choice stay as she gave them ("…disebut ....").
  if (question.kind === "text") return words.trim() || null;
  const text = words.trim().replace(/[.!?]+$/u, "");
  if (!text) return null;
  if (question.kind === "key") return text.toLowerCase().match(/\b([a-j])\b/u)?.[1] ?? null;
  if (question.kind === "image") {
    // "lewati saja" / "nanti saya pasang".
    if (/\blewat/iu.test(text)) return question.options[0] ?? null;
    if (/\b(nanti|pasang|sendiri)\b/iu.test(text)) return question.options[1] ?? null;
  }
  if (question.kind === "section" || question.kind === "image") {
    const lower = text.toLowerCase();
    return question.options.find((option) => lower.includes(option.toLowerCase())) ?? null;
  }
  return null;
}

type Choices = readonly [NemuChoice, NemuChoice] | readonly [NemuChoice, NemuChoice, NemuChoice];

/** Kartu Pilih's two or three choices; null when the question has fewer (she types or says it). */
export function choicesFor(question: QuizScriptQuestion): Choices | null {
  const options = question.options.slice(0, 3);
  if (options.length < 2) return null;
  return options.map((option, index) => ({
    id: String(index),
    label: question.kind === "key" ? `Pilihan ${option}` : option,
  })) as unknown as Choices;
}
