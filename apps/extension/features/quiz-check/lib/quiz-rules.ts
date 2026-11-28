import type { QuizProblem, QuizSnapshot } from "@nemu/contracts/quiz";

/**
 * F4-01's DOM rules (#209): what Nemu can tell is wrong with a quiz from its own pages, each as the
 * one sentence Nemu says while pointing at it. Judgement calls (does a question suit the class?)
 * are #218's and come from the Nemu Service.
 */

/** "Soal 15 belum ada gambarnya" → "Soal 15 belum ada gambarnya, Bu." */
function say(sentence: string, honorific: string): string {
  return honorific ? `${sentence}, ${honorific}.` : `${sentence}.`;
}

/** "Bu" → "Ibu isi …", "Pak" → "Bapak isi …"; with no honorific, just "Isi …". */
function ask(rest: string, honorific: string): string {
  const who = honorific === "Bu" ? "Ibu" : honorific === "Pak" ? "Bapak" : honorific;
  return who ? `${who} ${rest}.` : `${rest.charAt(0).toUpperCase()}${rest.slice(1)}.`;
}

const ONES = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

/** 2 → "dua", 14 → "empat belas"; a number past two words stays in digits (EYD). */
function countWord(count: number): string {
  if (count < 10) return ONES[count] ?? String(count);
  if (count === 10) return "sepuluh";
  if (count === 11) return "sebelas";
  if (count < 20) return `${ONES[count - 10]} belas`;
  return String(count);
}

/**
 * The one sentence after the last problem (#256), built from the count with no model call
 * (#218): "Selain dua hal itu, kuisnya sudah siap, Bu." Null when nothing was found, because the
 * quiz-ready sentence already says it.
 */
export function closingSentence(count: number, honorific: string): string | null {
  if (count <= 0) return null;
  const things = count === 1 ? "hal itu" : `${countWord(count)} hal itu`;
  return say(`Selain ${things}, kuisnya sudah siap`, honorific);
}

/** ["Gambar (2)", "Gambar (3)"] → "Gambar (2) dan Gambar (3)" */
function listed(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} dan ${names.at(-1)}`;
}

/**
 * Kenapa? for a missing image: what the preview showed, named by the images' alt text when every
 * one has it ("Di pratinjau, Gambar (3) tidak tampil. …").
 */
function missingImageWhy(alts: string[]): string {
  const what = alts.every(Boolean)
    ? listed(alts)
    : alts.length === 1
      ? "gambar di soal ini"
      : `${countWord(alts.length)} gambar di soal ini`;
  return `Di pratinjau, ${what} tidak tampil. Siswa hanya melihat tempatnya kosong.`;
}

/** A class the way schools write it ("4A", "10 IPA" is not one): a grade and a letter. */
const CLASS = /(?:^|[^\p{L}\p{N}])(\d{1,2})\s?([A-F])(?![\p{L}\p{N}])/u;

export function classIn(text: string): string | null {
  const match = text.toUpperCase().match(CLASS);
  return match ? `${match[1]}${match[2]}` : null;
}

/** "2026-12-04T21:00" as a local time (the teacher's computer shows the school's time zone). */
function localTime(value: string): Date {
  const [date = "", time = "00:00"] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
}

/** "4 Desember 2026, 21.00" */
function spokenTime(value: string): string {
  const time = localTime(value);
  const date = time.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const clock = time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${clock}`;
}

export function checkQuiz(
  quiz: QuizSnapshot,
  options: { now: Date; honorific: string; utterance: string },
): QuizProblem[] {
  const { honorific } = options;
  const problems: QuizProblem[] = [];

  // Missing images first, then missing keys, each by question number: what students can't see
  // comes before what only grading gets wrong (F4-1's soal 15, then soal 7).
  const bySlot = [...quiz.questions].sort((a, b) => a.slot - b.slot);
  for (const question of bySlot) {
    const missing = question.images.filter((image) => !image.loaded);
    if (missing.length === 0) continue;
    problems.push({
      kind: "missing_image",
      slot: question.slot,
      sentence: say(`Soal ${question.slot} belum ada gambarnya`, honorific),
      why: missingImageWhy(missing.map((image) => image.alt.trim())),
    });
  }
  for (const question of bySlot) {
    if (question.hasKey !== false) continue;
    // PRD v2.3: Nemu says where to fill the key and never proposes one ("Kuncinya setrika, Bu?").
    // Where to fill it goes on the quieter detail line, under the sentence the key expects.
    problems.push({
      kind: "no_key",
      slot: question.slot,
      sentence: say(`Soal ${question.slot} belum ada kunci jawabannya`, honorific),
      detail: `${ask("isi kuncinya lewat Edit soal", honorific)} Nemu tidak mengubahnya.`,
      why: `Semua pilihan di Soal ${question.slot} bernilai 0, jadi siswa yang menjawab benar pun mendapat 0.`,
    });
  }

  // Question count: none at all, students seeing a different number, or not what she said.
  const expected = Number(options.utterance.match(/(\d+)\s*soal\b/iu)?.[1] ?? NaN);
  if (quiz.listed === 0)
    problems.push({
      kind: "question_count",
      slot: null,
      sentence: say("Kuis ini belum punya soal", honorific),
    });
  else if (quiz.questions.length !== quiz.listed)
    problems.push({
      kind: "question_count",
      slot: null,
      sentence: say(
        `Siswa melihat ${quiz.questions.length} soal, padahal di halaman Soal ada ${quiz.listed}`,
        honorific,
      ),
    });
  else if (Number.isInteger(expected) && expected !== quiz.listed)
    problems.push({
      kind: "question_count",
      slot: null,
      sentence: say(`Kuis ini berisi ${quiz.listed} soal, bukan ${expected}`, honorific),
    });

  // Class: the quiz's name, or what she asked for, names another class than its course.
  const courseClass = classIn(quiz.course);
  const named = classIn(quiz.name);
  const asked = classIn(options.utterance);
  if (courseClass && named && named !== courseClass)
    problems.push({
      kind: "class",
      slot: null,
      sentence: say(
        `Nama kuis menyebut kelas ${named}, tapi kuisnya ada di kelas ${courseClass}`,
        honorific,
      ),
    });
  else if (courseClass && asked && asked !== courseClass)
    problems.push({
      kind: "class",
      slot: null,
      sentence: say(`Kuis ini ada di kelas ${courseClass}, bukan ${asked}`, honorific),
    });

  // Open and close times.
  if (quiz.opens && quiz.closes && localTime(quiz.closes) <= localTime(quiz.opens))
    problems.push({
      kind: "times",
      slot: null,
      sentence: say("Waktu tutup kuis ini lebih awal dari waktu bukanya", honorific),
    });
  else if (quiz.closes && localTime(quiz.closes) < options.now)
    problems.push({
      kind: "times",
      slot: null,
      sentence: say(
        `Kuis ini sudah ditutup ${spokenTime(quiz.closes)}, jadi siswa tidak bisa mengerjakannya`,
        honorific,
      ),
    });

  return problems;
}
