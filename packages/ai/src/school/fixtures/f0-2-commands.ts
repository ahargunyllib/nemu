import { asksToBeTaught, parseGradeCommand, quizCommand, routeCommand } from "../commands.js";
import type { TeacherProfile } from "../profile.js";

/**
 * F0-2 (07_F0_fondasi/F0-2_perintah-suara.csv): ten everyday commands, two mixed with Javanese
 * (no. 2 and 3), each with what Nemu must take from it. `variants` are what a recognizer plausibly
 * writes for the same words: no punctuation, number words, Javanese spellings, small slips.
 */

/** Bu Siti in the official school profile: 4A (IPAS, Bahasa Inggris, Tahfidz), 4B (Matematika, Bahasa Indonesia). */
export const F0_2_TEACHER: Pick<TeacherProfile, "classes" | "subjects" | "honorific"> = {
  classes: ["4A", "4B"],
  subjects: ["IPAS", "Bahasa Inggris", "Tahfidz", "Matematika", "Bahasa Indonesia"],
  honorific: "Bu",
};

/** The active BPMN processes `helpRoute` matches against (F3-1, and one more as a distractor). */
export const F0_2_PROCESSES = ["Catat Hafalan Tahfidz", "Pengajuan Izin Guru"];

export type CommandIntent = {
  intent: string;
  className?: string;
  subject?: string;
  assessment?: string;
  cara?: 1 | 2;
  processName?: string;
};

/**
 * What Nemu takes from a sentence, in the order the extension decides it (answerQuestion): its own
 * quiz commands first, then `helpRoute`, then for grade entry `gradesParseCommand`.
 */
export function commandIntent(
  utterance: string,
  processNames: readonly string[] = F0_2_PROCESSES,
  teacher: Pick<TeacherProfile, "classes" | "subjects" | "honorific"> = F0_2_TEACHER,
): CommandIntent {
  const quiz = quizCommand(utterance);
  if (quiz) return { intent: quiz };
  const route = routeCommand(utterance, processNames);
  if (route.kind === "control") return { intent: `control:${route.control}` };
  if (route.intent === "proses") return { intent: "proses", processName: route.processName ?? "" };
  if (route.intent !== "input_nilai") return { intent: route.intent };
  const command = parseGradeCommand(utterance, teacher);
  const cara = asksToBeTaught(utterance) ? 2 : 1;
  if (command.status === "ask") return { intent: "input_nilai", cara };
  const { className, subject, assessment } = command;
  return { intent: "input_nilai", className, subject, assessment, cara };
}

/** True when every part the sentence names was taken (F0-2 scoring: "termasuk kelas, mapel, …"). */
export function intentMatches(actual: CommandIntent, expected: CommandIntent): boolean {
  return (Object.keys(expected) as (keyof CommandIntent)[]).every(
    (key) => actual[key] === expected[key],
  );
}

export const F0_2_COMMANDS: ReadonlyArray<{
  no: number;
  sentence: string;
  expected: CommandIntent;
  variants: readonly string[];
}> = [
  {
    no: 1,
    sentence: "Nemu, masukkan nilai UTS Matematika 4B dari foto tadi.",
    expected: {
      intent: "input_nilai",
      className: "4B",
      subject: "Matematika",
      assessment: "UTS",
      cara: 1,
    },
    variants: [
      "nemu masukkan nilai uts matematika 4b dari foto tadi",
      "Nemu, masukan nilai UTS matematika empat B dari foto tadi.",
      "Nemo masukin nilai U T S Matematika 4 B dari foto tadi",
    ],
  },
  {
    no: 2,
    sentence: "Nemu, tulung isiake nilai UTS Matematika 4A.",
    expected: {
      intent: "input_nilai",
      className: "4A",
      subject: "Matematika",
      assessment: "UTS",
      cara: 1,
    },
    variants: [
      "Nemu tulung isiakne nilai UTS Matematika 4A",
      "Nemu, tolong isikan nilai UTS matematika empat A.",
      "Nemu tulung isekne nilai uts matematika papat a",
      "Nemu, tulung isi ake nilai UTS Matematika 4A.",
      // Heard by whisper-large-v3-turbo from a synthetic voice.
      "Nemu, Tulung Isyake Nilai UTS Matematika 4A.",
    ],
  },
  {
    no: 3,
    sentence: "Nemu, nilaine Aisyah kok ora metu.",
    expected: { intent: "kenapa" },
    variants: [
      "Nemu nilainya Aisyah kok ora metu",
      "Nemu, nilaine Aisyah kok ra metu?",
      "Nemu nilai ne Aisyah kok ora metu",
      "Nemu, nilainya Aisyah ora metu.",
      "Nemu nilainya Aisyah ke orang metu.",
    ],
  },
  {
    no: 4,
    sentence: "Nemu, ini kenapa?",
    expected: { intent: "kenapa" },
    variants: ["Nemu ini kenapa", "Nemu, ini kenapa ya?", "Nemu iki kenopo", "Namu ini kenapa?"],
  },
  {
    no: 5,
    sentence: "Ajari saya ngisi nilai sendiri, ya.",
    expected: { intent: "input_nilai", cara: 2 },
    variants: [
      "Ajari saya ngisi nilai sendiri ya",
      "Ajarin saya ngisi nilai sendiri, nggih.",
      "Ajari saya mengisi nilai sendiri.",
    ],
  },
  {
    no: 6,
    sentence: "Tolong cek kuis IPAS 4A, ada yang kurang nggak.",
    expected: { intent: "quiz-check" },
    variants: [
      "Tolong cek kuis IPAS 4A ada yang kurang nggak",
      "Tolong cek quiz IPAS 4A, ada yang kurang enggak?",
      "Tolong ngecek kuis IPAS empat A, ada yang kurang gak",
    ],
  },
  {
    no: 7,
    sentence: "Pasang soal dari file ini ke Moodle kelas 4A, buka Senin sampai Kamis.",
    expected: { intent: "quiz-import" },
    variants: [
      "Pasang soal dari file ini ke Moodle kelas 4A buka Senin sampai Kamis",
      "Pasang soal dari file ini ke Mudel kelas empat A, buka Senin sampai Kamis.",
      "Pasangkan soal dari file ini ke Moodle kelas 4A. Buka Senin sampai Kamis.",
    ],
  },
  {
    no: 8,
    sentence: "Tolong hapus latihan bahasa Inggris yang kemarin.",
    expected: { intent: "quiz-delete" },
    variants: [
      "Tolong hapus latihan bahasa Inggris yang kemarin",
      "Tolong hapus latian bahasa Inggris yang kemarin.",
      "Tulung busak latihan bahasa Inggris sing wingi",
    ],
  },
  {
    no: 9,
    sentence: "Catat setoran hafalan 4A hari ini.",
    expected: { intent: "proses", processName: "Catat Hafalan Tahfidz" },
    variants: [
      "Catat setoran hafalan 4A hari ini",
      "Catat setoran hafalan empat A hari ini.",
      "Catat setoran hapalan 4A hari ini.",
    ],
  },
  {
    no: 10,
    sentence: "Remedial itu boleh berapa kali, ya?",
    expected: { intent: "tanya" },
    variants: [
      "Remedial itu boleh berapa kali ya",
      "Remedial itu boleh berapa kali, nggih?",
      "Remidial itu boleh berapa kali ya?",
      "Remedial iku oleh piro kali, ya?",
    ],
  },
];
