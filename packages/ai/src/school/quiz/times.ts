import type { QuizTime } from "@nemu/contracts/quiz";

/**
 * F4-03: the open and close times a teacher says ("buka Senin 30 November, tutup Kamis 3 Desember
 * jam 9 malam"). A date she names comes with the clock time she said, or `time: null` when she
 * said none, so the caller can use 00.00 / 23.59 and say so. Nothing is guessed: a time she
 * didn't mention is null.
 */

const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  ags: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  nopember: 11,
  desember: 12,
  des: 12,
};

const WEEKDAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"] as const;

const MONTH = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const WEEKDAY = "senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad";

const OPENS = /\b(buka|dibuka|bukanya|mulai|dimulai|dari)\b/gu;
const CLOSES =
  /\b(tutup|ditutup|tutupnya|sampai|hingga|s\.?d\.?|batas|berakhir|selesai|deadline)\b/gu;

type Mention = { at: number; end: number; date: string };

function iso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** A date without a year is the next one from today (a quiz isn't set in the past). */
function withYear(month: number, day: number, year: number | null, today: string): string | null {
  if (year !== null) return iso(year < 100 ? 2000 + year : year, month, day);
  const thisYear = Number(today.slice(0, 4));
  const candidate = iso(thisYear, month, day);
  if (!candidate) return null;
  return candidate < today ? iso(thisYear + 1, month, day) : candidate;
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Senin" alone: the next Monday after today. */
function nextWeekday(name: string, today: string): string {
  const wanted = WEEKDAYS.indexOf(
    name.replace("'", "").replace("ahad", "minggu") as (typeof WEEKDAYS)[number],
  );
  const current = new Date(`${today}T00:00:00Z`).getUTCDay();
  const ahead = (wanted - current + 7) % 7 || 7;
  return addDays(today, ahead);
}

function dateMentions(text: string, today: string): Mention[] {
  const mentions: Mention[] = [];
  const taken = (at: number) => mentions.some((mention) => at >= mention.at && at < mention.end);
  const named = new RegExp(
    `(?:\\b(?:${WEEKDAY})\\b,?\\s*)?\\b(\\d{1,2})\\s+(${MONTH})\\b\\.?(?:\\s+(\\d{4}))?`,
    "gu",
  );
  for (const match of text.matchAll(named)) {
    const date = withYear(
      MONTHS[match[2]!]!,
      Number(match[1]),
      match[3] ? Number(match[3]) : null,
      today,
    );
    if (date) mentions.push({ at: match.index, end: match.index + match[0].length, date });
  }
  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/gu;
  for (const match of text.matchAll(numeric)) {
    if (taken(match.index)) continue;
    const date = withYear(
      Number(match[2]),
      Number(match[1]),
      match[3] ? Number(match[3]) : null,
      today,
    );
    if (date) mentions.push({ at: match.index, end: match.index + match[0].length, date });
  }
  const relative = new RegExp(`\\b(hari ini|besok|lusa|(?:hari\\s+)?(${WEEKDAY}))\\b`, "gu");
  for (const match of text.matchAll(relative)) {
    if (taken(match.index)) continue;
    const word = match[1]!;
    const date =
      word === "hari ini"
        ? today
        : word === "besok"
          ? addDays(today, 1)
          : word === "lusa"
            ? addDays(today, 2)
            : nextWeekday(match[2]!, today);
    mentions.push({ at: match.index, end: match.index + match[0].length, date });
  }
  return mentions.sort((a, b) => a.at - b.at);
}

/** "jam 7", "pukul 07.00", "jam 9 malam", "21:00" → "HH:MM". */
function clockIn(text: string): string | null {
  const match = text.match(
    /(?:\b(?:jam|pukul|pk\.?)\s*(\d{1,2})(?:[.:](\d{2}))?|\b(\d{1,2})[.:](\d{2})\b)(?:\s*(pagi|siang|sore|malam|wib))?/u,
  );
  if (!match) return null;
  let hour = Number(match[1] ?? match[3]);
  const minute = Number(match[2] ?? match[4] ?? 0);
  const part = match[5];
  if ((part === "sore" || part === "malam") && hour < 12) hour += 12;
  if (part === "siang" && hour < 11) hour += 12;
  if (part === "malam" && hour === 24) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function lastBefore(pattern: RegExp, text: string, at: number): number {
  let last = -1;
  for (const match of text.matchAll(pattern)) if (match.index < at) last = match.index;
  return last;
}

/** The open and close times in her words; each null when she named no date for it. */
export function quizTimesFrom(
  words: string,
  today: string,
): { opens: QuizTime | null; closes: QuizTime | null } {
  const text = words.toLocaleLowerCase("id-ID");
  const mentions = dateMentions(text, today);
  let opens: QuizTime | null = null;
  let closes: QuizTime | null = null;
  mentions.forEach((mention, index) => {
    const next = mentions[index + 1]?.at ?? text.length;
    // The clock time said with this date: up to the next date or the next open/close word.
    const after = text.slice(mention.end, next);
    const cut = after.search(new RegExp(`${OPENS.source}|${CLOSES.source}`, "u"));
    const time = clockIn(cut >= 0 ? after.slice(0, cut) : after);
    const value: QuizTime = { date: mention.date, time };
    const open = lastBefore(OPENS, text, mention.at);
    const close = lastBefore(CLOSES, text, mention.at);
    const isClose = close > open || (close < 0 && open < 0 && opens !== null);
    if (isClose) closes ??= value;
    else if (opens === null) opens = value;
    else closes ??= value;
  });
  return { opens, closes };
}

/** What Nemu uses for a time she didn't say: the start of the open day, the end of the close day. */
export const DEFAULT_OPEN_TIME = "00:00";
export const DEFAULT_CLOSE_TIME = "23:59";
