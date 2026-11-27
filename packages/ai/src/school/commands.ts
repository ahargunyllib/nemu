import type { CommandRoute, GradeCommand, VoiceControl } from "@nemu/contracts/school";

import type { TeacherProfile } from "./profile.js";

/**
 * Command understanding without a model call where code can decide: voice controls are matched
 * before anything else so "berhenti" is instant and free (F0-06), and the grade command's class,
 * subject and assessment are parsed from the teacher's own lists (F1-05). Spoken Javanese and the
 * recognizer's usual slips are mapped to Indonesian first (F0-2).
 */

/**
 * Words a teacher mixes in from Javanese or everyday speech, and the recognizer's usual slips,
 * mapped to the Indonesian the rules below look for: "tulung isiake nilai" is "tolong isi nilai",
 * "nilaine kok ora metu" is "nilai kok tidak muncul".
 */
const SPOKEN_WORDS: Record<string, string> = {
  tulung: "tolong",
  tulong: "tolong",
  isiake: "isi",
  isyake: "isi",
  isyakne: "isi",
  isake: "isi",
  isakne: "isi",
  isiakne: "isi",
  isiaken: "isi",
  isekne: "isi",
  isikne: "isi",
  isikke: "isi",
  isikake: "isi",
  isikno: "isi",
  isiin: "isi",
  isikan: "isi",
  ngisi: "isi",
  ngisiin: "isi",
  ngisike: "isi",
  ngisekne: "isi",
  mengisi: "isi",
  lebokke: "masukkan",
  lebokne: "masukkan",
  lebokno: "masukkan",
  mlebokke: "masukkan",
  nglebokke: "masukkan",
  masukan: "masukkan",
  masukin: "masukkan",
  memasukkan: "masukkan",
  nilaine: "nilai",
  nilaie: "nilai",
  nilainya: "nilai",
  bijine: "nilai",
  ora: "tidak",
  ra: "tidak",
  mboten: "tidak",
  boten: "tidak",
  gak: "tidak",
  ga: "tidak",
  nggak: "tidak",
  enggak: "tidak",
  ndak: "tidak",
  kagak: "tidak",
  metu: "muncul",
  medal: "muncul",
  keluar: "muncul",
  kenopo: "kenapa",
  ngopo: "kenapa",
  ngapa: "kenapa",
  napa: "kenapa",
  piye: "bagaimana",
  kepiye: "bagaimana",
  pripun: "bagaimana",
  gimana: "bagaimana",
  piro: "berapa",
  pira: "berapa",
  pinten: "berapa",
  iki: "ini",
  niki: "ini",
  iku: "itu",
  niku: "itu",
  saiki: "sekarang",
  sakniki: "sekarang",
  wingi: "kemarin",
  sing: "yang",
  hapalan: "hafalan",
  nggih: "ya",
  inggih: "ya",
  nggeh: "ya",
  mangga: "silakan",
  monggo: "silakan",
  ngecek: "cek",
  mengecek: "cek",
  cekno: "cek",
  cekke: "cek",
  mriksa: "periksa",
  memeriksa: "periksa",
  busak: "hapus",
  dibusak: "hapus",
  ngapus: "hapus",
  latian: "latihan",
  kwis: "kuis",
  quiz: "kuis",
  kuisnya: "kuis",
  nemo: "nemu",
  nemuh: "nemu",
  namu: "nemu",
  mudel: "moodle",
  mudle: "moodle",
  moodel: "moodle",
  matematik: "matematika",
};

/** Class numbers said as words, Indonesian or Javanese: "kelas papat a" is 4A. */
const NUMBER_WORDS: Record<string, string> = {
  satu: "1",
  siji: "1",
  dua: "2",
  loro: "2",
  tiga: "3",
  telu: "3",
  empat: "4",
  papat: "4",
  lima: "5",
  limo: "5",
  enam: "6",
  enem: "6",
};

const SPOKEN_CLASS = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).join("|")}|\\d{1,2}) ([a-f])\\b`,
  "gu",
);

/**
 * Lowercase words with "." "?" "!" kept as sentence ends, spoken Javanese and recognizer slips
 * mapped to Indonesian, and a spoken class ("empat b", "4 b") written as "4b".
 */
export function normalizeUtterance(utterance: string): string {
  return (
    utterance
      .toLocaleLowerCase("id-ID")
      .replace(/\bu\.?\s?t\.?\s?s\b|\bute es\b/gu, "uts")
      // Javanese "ora metu" (doesn't show) that the recognizer heard as Indonesian "orang".
      .replace(/\borang metu\b/gu, "ora metu")
      .replace(/[^\p{L}\p{N}.?!]+/gu, " ")
      .replace(/[.?!]+/gu, (end) => ` ${end[0]} `)
      .split(" ")
      .filter(Boolean)
      .map((word) => SPOKEN_WORDS[word] ?? word)
      .join(" ")
      .replace(SPOKEN_CLASS, (_match, number: string, letter: string) => {
        return `${NUMBER_WORDS[number] ?? number}${letter}`;
      })
      .replace(/ ([.?!])/gu, "$1")
  );
}

/**
 * Short controls (F0-15) count only as the whole utterance, so "ulangi pertanyaan saya tentang
 * KKM" is a question and "Ajari saya ngisi nilai sendiri" is grade entry in cara 2.
 */
const CONTROL_PHRASES: Record<Exclude<VoiceControl, "berhenti">, readonly string[]> = {
  pelan: ["pelan", "pelan pelan", "pelankan", "lebih pelan", "pelan sedikit", "lebih lambat"],
  ulangi: ["ulangi", "ulang", "sekali lagi", "apa tadi", "bagaimana tadi"],
  ajari_saya: ["ajari saya", "ajarin saya", "ajarkan saya", "ajari aku", "ajari", "ajarin"],
  lanjut: ["lanjut", "lanjutkan", "teruskan", "terus", "saja yang lanjut", "silakan lanjut"],
  saya_saja: ["saya saja", "saya aja", "saya sendiri", "biar saya", "saya isi sendiri"],
};

const CONTROL_LOOKUP = new Map<string, VoiceControl>(
  Object.entries(CONTROL_PHRASES).flatMap(([control, phrases]) =>
    phrases.map((phrase) => [phrase, control as VoiceControl] as const),
  ),
);

/** Words around a control that change nothing: "Nemu, tolong ulangi ya." */
const LEADING = new Set(["nemu", "tolong", "coba", "ya", "eh", "oke", "ok", "bu", "pak"]);
const TRAILING = new Set(["ya", "dong", "nemu", "deh", "sih", "lagi", "saja", "aja", "dulu"]);

/** "Berhenti" counts at the start of anything she says, so stopping is instant (F0-06). */
const STOP = /^(nemu[,\s]+)?(berhenti|stop|setop|cukup|sudah dulu|udah dulu|batal)\b/iu;

export function matchVoiceControl(utterance: string): VoiceControl | null {
  if (STOP.test(utterance.trim())) return "berhenti";
  const words = normalizeUtterance(utterance).replace(/[.?!]/gu, " ").split(" ").filter(Boolean);
  while (words.length > 1 && LEADING.has(words[0]!)) words.shift();
  for (;;) {
    const control = CONTROL_LOOKUP.get(words.join(" "));
    if (control) return control;
    if (words.length <= 1 || !TRAILING.has(words.at(-1)!)) return null;
    words.pop();
  }
}

export function routeCommand(
  utterance: string,
  processNames: readonly string[] = [],
): CommandRoute {
  const control = matchVoiceControl(utterance);
  if (control) return { kind: "control", control };
  const text = normalizeUtterance(utterance);
  // "Nilai Budi sudah saya masukkan, tapi kenapa tidak muncul?" asks why, it doesn't enter grades.
  if (/\b(kenapa|mengapa|kok)\b|\b(tidak|belum) (muncul|tampil|kelihatan|terlihat)\b/u.test(text)) {
    return { kind: "intent", intent: "kenapa", processName: null };
  }
  if (/\bnilai\b/u.test(text) && /\b(masuk|masukkan|input|isi|entri|ketik)\b/u.test(text)) {
    return { kind: "intent", intent: "input_nilai", processName: null };
  }
  if (/\b(ini apa|error|eror|gagal|tidak bisa|macet)\b/u.test(text)) {
    return { kind: "intent", intent: "kenapa", processName: null };
  }
  // The process whose name shares the most words with the sentence (a tie keeps the first).
  const words = new Set(text.split(/[\s.?!]+/u));
  let process: string | undefined;
  let best = 0;
  for (const name of processNames) {
    const shared = name
      .toLocaleLowerCase("id-ID")
      .split(/\s+/u)
      .filter(
        (word) => word.length > 3 && !["pengajuan", "proses", "form", "formulir"].includes(word),
      )
      .filter((word) => words.has(word)).length;
    if (shared > best) {
      best = shared;
      process = name;
    }
  }
  if (process) return { kind: "intent", intent: "proses", processName: process };
  if (/\b(berapa|apa|bagaimana|boleh|kapan|siapa|apakah|harus)\b/u.test(text)) {
    return { kind: "intent", intent: "tanya", processName: null };
  }
  return { kind: "intent", intent: "unknown", processName: null };
}

export type QuizCommand = "quiz-check" | "quiz-delete" | "quiz-import";

const QUIZ_DELETE =
  /\b(?:hapus|hapuskan|menghapus|ganti|gantikan|mengganti|delete|remove)\b[^.?!]*\b(?:kuis|latihan|ulangan)\b/u;
const QUIZ_IMPORT = [
  /\b(?:masukkan|buat|buatkan|bikin|bikinkan|pasang|pasangkan|impor|import|jadikan|unggah|upload)\b[^.?!]*\bkuis\b/u,
  /\bnaskah\b[^.?!]*\b(?:kuis|moodle)\b|\bkuis\b[^.?!]*\bnaskah\b/u,
  // "Pasang soal dari file ini ke Moodle kelas 4A" (F0-2 no. 7).
  /\b(?:masukkan|pasang|pasangkan|impor|import|unggah|upload)\b[^.?!]*\b(?:soal|file)\b[^.?!]*\bmoodle\b/u,
];
const QUIZ_CHECK = /\b(?:cek|cekkan|periksa|periksakan|check)\b[^.?!]*\bkuis\b/u;

/**
 * The Moodle quiz commands the extension runs itself, without `helpRoute`: deleting or replacing a
 * quiz, which Nemu never does (F4-06); putting the teacher's script into Moodle (F4-03); checking
 * a quiz the way students see it (F4-01). Grades for a quiz ("masukkan nilai kuis") are F1's.
 */
export function quizCommand(utterance: string): QuizCommand | null {
  const text = normalizeUtterance(utterance);
  if (QUIZ_DELETE.test(text)) return "quiz-delete";
  if (/\bnilai\b/u.test(text)) return null;
  if (QUIZ_IMPORT.some((pattern) => pattern.test(text))) return "quiz-import";
  if (QUIZ_CHECK.test(text)) return "quiz-check";
  return null;
}

/** "Ajari saya ngisi nilai sendiri": cara 2, Nemu points and she types (F1-11). */
export function asksToBeTaught(utterance: string): boolean {
  return /\b(?:ajari|ajarin|ajarkan|tuntun|bimbing) (?:saya|aku)\b/u.test(
    normalizeUtterance(utterance),
  );
}

const ASSESSMENTS: ReadonlyArray<[string, RegExp]> = [
  ["UTS", /\b(uts|ujian tengah semester|pts|penilaian tengah semester)\b/iu],
  ["UAS", /\b(uas|ujian akhir semester|pas|penilaian akhir semester)\b/iu],
  ["UH", /\b(uh|ulangan harian)\s*(\d+)?\b/iu],
  ["Tugas", /\b(tugas)\s*(\d+)?\b/iu],
  ["PR", /\b(pr)\s*(\d+)?\b/iu],
];

function normalizeClass(value: string): string {
  return value.replace(/\s+/gu, "").toUpperCase();
}

export function parseGradeCommand(
  utterance: string,
  teacher: Pick<TeacherProfile, "classes" | "subjects" | "honorific">,
): GradeCommand {
  const text = normalizeUtterance(utterance);

  const classMatch = text.match(/\b(?:kelas\s*)?(\d{1,2})([a-f])\b/u);
  const spokenClass = classMatch ? normalizeClass(`${classMatch[1]}${classMatch[2]}`) : null;
  // A class she named that isn't hers is asked about, never swapped for her only class.
  const className = spokenClass
    ? (teacher.classes.find((item) => normalizeClass(item) === spokenClass) ?? null)
    : teacher.classes.length === 1
      ? teacher.classes[0]!
      : null;

  const subject =
    teacher.subjects.find((item) => text.includes(item.toLocaleLowerCase("id-ID"))) ??
    teacher.subjects.find((item) => {
      const short: Record<string, string> = {
        matematika: "mtk",
        "bahasa indonesia": "b indo",
        "ilmu pengetahuan alam": "ipa",
      };
      const alias = short[item.toLocaleLowerCase("id-ID")];
      return !!alias && text.includes(alias);
    }) ??
    (teacher.subjects.length === 1 ? teacher.subjects[0]! : null);

  let assessment: string | null = null;
  for (const [label, pattern] of ASSESSMENTS) {
    const match = text.match(pattern);
    if (match) {
      const number = match[2];
      assessment = number ? `${label} ${number}` : label;
      break;
    }
  }

  const honorific = teacher.honorific;
  if (!className) {
    return { status: "ask", missing: "className", question: `Nilai kelas berapa, ${honorific}?` };
  }
  if (!subject) {
    return { status: "ask", missing: "subject", question: `Mata pelajarannya apa, ${honorific}?` };
  }
  if (!assessment) {
    return {
      status: "ask",
      missing: "assessment",
      question: `Nilai apa, ${honorific}? UTS, UH, atau tugas?`,
    };
  }
  return {
    status: "ok",
    className,
    subject,
    assessment,
    ...(asksToBeTaught(utterance) ? { cara: 2 as const } : {}),
  };
}
