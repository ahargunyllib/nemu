import type { VerificationQuestion } from "@nemu/contracts/school";
import type { NemuChoice } from "@nemu/ui/lib/nemu-display";

/**
 * W5 (F1-06): each verification question as a Kartu Pilih, and the teacher's answer by button,
 * voice or the type box. Nothing is pre-selected; a digit or S/I/A question always offers
 * "Angka lain", a name question "Tidak ada di daftar". Answers follow `verificationAnswerSchema`:
 * a value or "blank" for a digit, a studentId or "none" for a name, "Kosongkan" or a value for S/I/A.
 */

export const OTHER_NUMBER = "lain";
const ANSWER_PREFIX = "jawab:";

export type QuestionReply = { answer: string } | { other: true };

type Choices = readonly [NemuChoice, NemuChoice] | readonly [NemuChoice, NemuChoice, NemuChoice];

function choice(answer: string, label: string): NemuChoice {
  return { id: `${ANSWER_PREFIX}${answer}`, label };
}

const OTHER: NemuChoice = { id: OTHER_NUMBER, label: "Angka lain" };

/** At most three equal buttons (Kartu Pilih); "Angka lain" covers any reading left out. */
export function questionChoices(question: VerificationQuestion): Choices {
  switch (question.kind) {
    case "digit": {
      const readings = question.options.slice(0, 2).map((value) => choice(value, value));
      if (readings.length === 0) return [OTHER, choice("blank", "Kosongkan")];
      return [...readings, OTHER] as unknown as Choices;
    }
    case "absence":
      return [choice("Kosongkan", "Kosongkan"), OTHER];
    case "name": {
      const none = choice("none", "Tidak ada di daftar");
      const names = question.options
        .slice(0, 2)
        .map((candidate) => choice(candidate.studentId, candidate.name));
      return (names.length ? [...names, none] : [none, OTHER]) as unknown as Choices;
    }
  }
}

export function replyFromChoice(id: string): QuestionReply {
  if (id === OTHER_NUMBER) return { other: true };
  return { answer: id.slice(ANSWER_PREFIX.length) };
}

// --- Spoken or typed answers ----------------------------------------------------------------------

const UNITS: Record<string, number> = {
  nol: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
};

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * A grade said or typed: "86", "nilainya 86", "delapan puluh enam", "seratus". Null when the
 * text holds no number from 0 to 100.
 */
export function spokenNumber(text: string): number | null {
  const plain = normalize(text);
  const digits = plain.match(/\b\d{1,3}\b/u);
  if (digits) {
    const value = Number(digits[0]);
    return value <= 100 ? value : null;
  }
  const words = plain
    .replace(/\bse(puluh|belas|ratus)\b/gu, "satu $1")
    .split(" ")
    .filter(Boolean);
  let total: number | null = null;
  let current: number | null = null;
  for (const word of words) {
    if (word in UNITS) {
      current = (current ?? 0) + UNITS[word]!;
    } else if (word === "puluh" && current !== null) {
      total = (total ?? 0) + current * 10;
      current = null;
    } else if (word === "belas" && current !== null) {
      total = (total ?? 0) + current + 10;
      current = null;
    } else if (word === "ratus" && current !== null) {
      total = (total ?? 0) + current * 100;
      current = null;
    } else if (total !== null || current !== null) break;
  }
  if (total === null && current === null) return null;
  const value = (total ?? 0) + (current ?? 0);
  return value <= 100 ? value : null;
}

function says(text: string, ...phrases: string[]): boolean {
  const plain = ` ${normalize(text)} `;
  return phrases.some((phrase) => plain.includes(` ${phrase} `));
}

/**
 * What the teacher's words answer, or null when they don't fit the question (Nemu then asks her
 * to press a button or say the number again).
 */
export function replyFromSpeech(
  question: VerificationQuestion,
  text: string,
): QuestionReply | null {
  if (says(text, "angka lain", "lain")) return { other: true };
  if (question.kind === "name") {
    if (says(text, "tidak ada", "nggak ada", "enggak ada", "bukan semua"))
      return { answer: "none" };
    const plain = ` ${normalize(text)} `;
    const named = question.options.filter((candidate) =>
      plain.includes(` ${normalize(candidate.name)} `),
    );
    if (named.length === 1) return { answer: named[0]!.studentId };
    const byFirstName = question.options.filter((candidate) =>
      plain.includes(` ${normalize(candidate.name).split(" ")[0]} `),
    );
    return byFirstName.length === 1 ? { answer: byFirstName[0]!.studentId } : null;
  }
  if (says(text, "kosongkan", "kosong", "dikosongkan"))
    return { answer: question.kind === "absence" ? "Kosongkan" : "blank" };
  const value = spokenNumber(text);
  return value === null ? null : { answer: String(value) };
}

/** A number typed or said after "Angka lain". */
export function replyFromNumber(text: string): QuestionReply | null {
  const value = spokenNumber(text);
  return value === null ? null : { answer: String(value) };
}
