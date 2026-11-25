import type { CommandRoute, GradeCommand, VoiceControl } from "@nemu/contracts/school";

import type { TeacherProfile } from "./profile.js";

/**
 * Command understanding without a model call where code can decide: voice controls are matched
 * before anything else so "berhenti" is instant and free (F0-06), and the grade command's class,
 * subject and assessment are parsed from the teacher's own lists (F1-05).
 */

const CONTROLS: ReadonlyArray<[VoiceControl, RegExp]> = [
  ["berhenti", /^(nemu[,\s]+)?(berhenti|stop|setop|cukup|sudah dulu|udah dulu|batal)\b/iu],
  ["saya_saja", /\b(saya (saja|aja|sendiri)|biar saya|ya,? saya isi sendiri)\b/iu],
  ["ajari_saya", /\b(ajari|ajarin|ajarkan) saya\b/iu],
  ["lanjut", /^(nemu[,\s]+)?(lanjut|lanjutkan|teruskan|terus|nemu saja yang lanjut)\b/iu],
  ["ulangi", /^(nemu[,\s]+)?(ulangi|ulang|apa tadi|sekali lagi|gimana tadi)\b/iu],
];

export function matchVoiceControl(utterance: string): VoiceControl | null {
  const text = utterance.trim();
  for (const [control, pattern] of CONTROLS) if (pattern.test(text)) return control;
  return null;
}

export function routeCommand(
  utterance: string,
  processNames: readonly string[] = [],
): CommandRoute {
  const control = matchVoiceControl(utterance);
  if (control) return { kind: "control", control };
  const text = utterance.toLocaleLowerCase("id-ID");
  if (
    /\bnilai\b/u.test(text) &&
    /\b(masuk|masukkan|masukin|input|isi|isikan|entri|ketik)\b/u.test(text)
  ) {
    return { kind: "intent", intent: "input_nilai", processName: null };
  }
  if (
    /\b(kenapa|ini apa|error|gagal|tidak bisa|nggak bisa|gak bisa|ga bisa|macet|kok)\b/u.test(text)
  ) {
    return { kind: "intent", intent: "kenapa", processName: null };
  }
  const process = processNames.find((name) =>
    name
      .toLocaleLowerCase("id-ID")
      .split(/\s+/u)
      .filter(
        (word) => word.length > 3 && !["pengajuan", "proses", "form", "formulir"].includes(word),
      )
      .some((word) => text.includes(word)),
  );
  if (process) return { kind: "intent", intent: "proses", processName: process };
  if (/\b(berapa|apa|bagaimana|gimana|boleh|kapan|siapa|apakah|harus)\b/u.test(text)) {
    return { kind: "intent", intent: "tanya", processName: null };
  }
  return { kind: "intent", intent: "unknown", processName: null };
}

const NUMBER_WORDS: Record<string, string> = {
  satu: "1",
  dua: "2",
  tiga: "3",
  empat: "4",
  lima: "5",
  enam: "6",
};

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
  let text = utterance.toLocaleLowerCase("id-ID");
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    text = text.replace(new RegExp(`\\b(kelas\\s+)?${word}\\s*([a-f])\\b`, "gu"), `$1${digit}$2`);
  }

  const classMatch = text.match(/\b(?:kelas\s*)?(\d{1,2})\s*([a-f])\b/u);
  const spokenClass = classMatch ? normalizeClass(`${classMatch[1]}${classMatch[2]}`) : null;
  const className =
    (spokenClass && teacher.classes.find((item) => normalizeClass(item) === spokenClass)) ??
    (teacher.classes.length === 1 ? teacher.classes[0]! : null);

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
  return { status: "ok", className, subject, assessment };
}
