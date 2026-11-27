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

  for (const question of [...quiz.questions].sort((a, b) => a.slot - b.slot)) {
    if (question.images.some((image) => !image.loaded))
      problems.push({
        kind: "missing_image",
        slot: question.slot,
        sentence: say(`Soal ${question.slot} belum ada gambarnya`, honorific),
      });
    if (question.hasKey === false)
      problems.push({
        kind: "no_key",
        slot: question.slot,
        sentence: say(`Soal ${question.slot} belum punya jawaban benar`, honorific),
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
