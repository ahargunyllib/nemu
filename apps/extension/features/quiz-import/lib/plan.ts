import { DEFAULT_CLOSE_TIME, DEFAULT_OPEN_TIME } from "@nemu/ai/school/quiz/times";
import type { QuizTime } from "@nemu/contracts/quiz";

/**
 * F4-03's words about times (#210): a date she said without a clock time opens at 00.00 and
 * closes at 23.59, and Nemu says so; a date she didn't say is asked.
 */

export type SetTime = { date: string; time: string };

export type ImportPlan = {
  courseId: number;
  section: string;
  name: string;
  opens: SetTime;
  closes: SetTime;
  xml: string;
  fileName: string;
  /** Questions in the XML. */
  count: number;
};

/** Which clock times Nemu chose because she didn't say them. */
export type Defaulted = "both" | "opens" | "closes" | null;

export function withDefaults(
  opens: QuizTime,
  closes: QuizTime,
): { opens: SetTime; closes: SetTime; defaulted: Defaulted } {
  const open = opens.time === null;
  const close = closes.time === null;
  return {
    opens: { date: opens.date, time: opens.time ?? DEFAULT_OPEN_TIME },
    closes: { date: closes.date, time: closes.time ?? DEFAULT_CLOSE_TIME },
    defaulted: open && close ? "both" : open ? "opens" : close ? "closes" : null,
  };
}

function localDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** "Senin, 7 Desember 2026" */
export function spokenDate(date: string): string {
  return localDate(date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "7 Desember pukul 00.00" */
export function spokenTime(time: SetTime): string {
  const day = localDate(time.date).toLocaleDateString("id-ID", { day: "numeric", month: "long" });
  return `${day} pukul ${time.time.replace(":", ".")}`;
}

function say(sentence: string, honorific: string): string {
  return honorific ? `${sentence}, ${honorific}.` : `${sentence}.`;
}

/** What Nemu says before it starts: the times, and that it chose the clock times she didn't say. */
export function timesSentence(
  opens: SetTime,
  closes: SetTime,
  defaulted: Defaulted,
  honorific: string,
): string {
  const both = `dibuka ${spokenTime(opens)} dan ditutup ${spokenTime(closes)}`;
  const unsaid = { both: "Jamnya", opens: "Jam bukanya", closes: "Jam tutupnya" };
  return say(
    defaulted ? `${unsaid[defaulted]} tidak disebut, jadi kuis ${both}` : `Kuis ${both}`,
    honorific,
  );
}

/** The one sentence after the F4-1 check finds nothing (#210). */
export function readySentence(plan: ImportPlan, listed: number, honorific: string): string {
  return say(
    `Kuis ${plan.name} sudah siap: ${listed} soal, dibuka ${spokenTime(plan.opens)} dan ditutup ${spokenTime(plan.closes)}`,
    honorific,
  );
}

/** The close comes after the open; otherwise Nemu asks again. */
export function timesInOrder(opens: SetTime, closes: SetTime): boolean {
  return `${closes.date}T${closes.time}` > `${opens.date}T${opens.time}`;
}
