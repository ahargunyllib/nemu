import { normalizeControlName } from "@nemu/ai/school/safety";

/**
 * Which quiz "hapus latihan bahasa Inggris yang kemarin" means (F4-06, #211), from the quizzes the
 * course page lists. The teacher's words are matched against each quiz's section and name, and a
 * day she names ("kemarin", "hari ini") against its open and close dates. A clear winner is picked;
 * when another quiz scores close (the F4-3 decoy), Nemu asks instead of guessing.
 */

/** A quiz as the course page lists it. Dates are the day shown, `YYYY-MM-DD`, or null. */
export type CourseQuiz = {
  cmid: number;
  name: string;
  section: string;
  opens: string | null;
  closes: string | null;
};

export type QuizPick =
  | { kind: "one"; quiz: CourseQuiz }
  | { kind: "ask"; candidates: CourseQuiz[] }
  | { kind: "none" };

/** Words that say nothing about which quiz: the command itself and small talk. */
const FILLER = new Set([
  "nemu",
  "tolong",
  "mohon",
  "coba",
  "dong",
  "ya",
  "yang",
  "ini",
  "itu",
  "saja",
  "aja",
  "di",
  "dari",
  "untuk",
  "kuis",
  "quiz",
  "hapus",
  "hapuskan",
  "menghapus",
  "ganti",
  "gantikan",
  "mengganti",
  "delete",
  "remove",
  "kemarin",
  "hari",
  "lusa",
  "tadi",
  "bu",
  "pak",
  "the",
  "a",
]);

/** A quiz this far ahead of the next one is clearly the one she means. */
const CLEAR_LEAD = 2;
/** Kartu Pilih holds two or three choices. */
const MAX_CANDIDATES = 3;

function words(text: string): string[] {
  return normalizeControlName(text).split(" ").filter(Boolean);
}

/** `YYYY-MM-DD` of `today` plus `days`, in the calendar (no time zone arithmetic on hours). */
export function addDays(today: string, days: number): string {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** The day her words name, if any: "kemarin" is yesterday, "hari ini" today. */
export function namedDay(utterance: string, today: string): string | null {
  const said = ` ${normalizeControlName(utterance)} `;
  if (said.includes(" kemarin ") || said.includes(" yesterday ")) return addDays(today, -1);
  if (said.includes(" hari ini ") || said.includes(" today ")) return today;
  return null;
}

function score(quiz: CourseQuiz, utterance: string, day: string | null): number {
  const said = ` ${normalizeControlName(utterance)} `;
  let points = 0;
  // The subject she names ("bahasa Inggris") is the section the quiz sits in.
  const section = normalizeControlName(quiz.section);
  if (section && said.includes(` ${section} `)) points += 2;
  const sectionWords = new Set(words(quiz.section));
  const named = new Set(words(quiz.name));
  for (const word of new Set(words(utterance))) {
    if (FILLER.has(word) || sectionWords.has(word)) continue;
    if (named.has(word)) points += 1;
  }
  if (day && quiz.opens) {
    // Given that day: the quiz opened then, or was open then.
    if (quiz.opens === day) points += 2;
    else if (quiz.opens <= day && (quiz.closes === null || day <= quiz.closes)) points += 1;
  }
  return points;
}

/**
 * The quiz she means, or the close ones to ask between. `today` is the teacher's own day,
 * `YYYY-MM-DD`. With one quiz on the course it is that one, unless her words match nothing.
 */
export function pickQuiz(quizzes: CourseQuiz[], utterance: string, today: string): QuizPick {
  if (quizzes.length === 0) return { kind: "none" };
  const day = namedDay(utterance, today);
  const ranked = quizzes
    .map((quiz) => ({ quiz, points: score(quiz, utterance, day) }))
    .sort((a, b) => b.points - a.points || (b.quiz.opens ?? "").localeCompare(a.quiz.opens ?? ""));
  const [first, second] = ranked as [(typeof ranked)[number], ...typeof ranked];
  if (first.points === 0)
    return quizzes.length === 1 ? { kind: "one", quiz: first.quiz } : { kind: "none" };
  if (!second || first.points - second.points >= CLEAR_LEAD)
    return { kind: "one", quiz: first.quiz };
  const close = ranked.filter(({ points }) => first.points - points < CLEAR_LEAD);
  return { kind: "ask", candidates: close.slice(0, MAX_CANDIDATES).map(({ quiz }) => quiz) };
}

const MONTHS: Record<string, number> = {
  januari: 1,
  january: 1,
  februari: 2,
  february: 2,
  maret: 3,
  march: 3,
  april: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  juli: 7,
  july: 7,
  agustus: 8,
  august: 8,
  september: 9,
  oktober: 10,
  october: 10,
  november: 11,
  desember: 12,
  december: 12,
};

/** "Senin, 30 November 2026, 07.00" (or "Monday, 30 November 2026, 7:00 AM") → "2026-11-30". */
export function parseMoodleDay(text: string): string | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/u);
  if (!match) return null;
  const month = MONTHS[(match[2] ?? "").toLowerCase()];
  if (!month) return null;
  const day = Number(match[1]);
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The teacher's day as her browser keeps it, `YYYY-MM-DD`. */
export function localDay(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
