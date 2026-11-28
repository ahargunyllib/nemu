import { z } from "zod";

/**
 * F4-01: a Moodle quiz as the Nemu Extension reads it from the quiz's own pages (#209): its
 * settings, the Soal page and the preview a student would see. The extension checks the DOM rules
 * itself (missing images, questions without a key, question count, class, open and close times);
 * the Nemu Service only adds checks that need judgement (#218), through `quizJudge`.
 */

export const quizQuestionSchema = z
  .object({
    /** The number students see ("Soal 15"). */
    slot: z.number().int().positive(),
    /** The question's name in the bank ("Soal 15"), "" when the page doesn't show it. */
    name: z.string().max(255),
    /** The question text as the preview shows it, without markup. */
    text: z.string().max(4000),
    /** False when its answers carry no grade above 0; null when the type has no key to read. */
    hasKey: z.boolean().nullable(),
    /** Images the preview shows; `loaded` is false when the browser couldn't load it. */
    images: z.array(z.object({ alt: z.string().max(255), loaded: z.boolean() })).max(40),
  })
  .strict();

export const quizSnapshotSchema = z
  .object({
    name: z.string().max(255),
    /** The course as the breadcrumb names it ("4A-UJI") and its full name ("Kelas 4A (uji)"). */
    course: z.string().max(255),
    section: z.string().max(255),
    /** Local wall-clock times from the settings page ("2026-12-02T07:00"), or null when not set. */
    opens: z.string().max(20).nullable(),
    closes: z.string().max(20).nullable(),
    maxGrade: z.number().nullable(),
    /** How many questions the Soal page lists. */
    listed: z.number().int().nonnegative(),
    questions: z.array(quizQuestionSchema).max(200),
  })
  .strict();

/** One problem and the sentence Nemu says while pointing at it ("Soal 15 belum ada gambarnya, Bu."). */
export const quizProblemSchema = z
  .object({
    kind: z.enum(["missing_image", "no_key", "question_count", "class", "times", "judgement"]),
    /** The question it is about, or null for the whole quiz. */
    slot: z.number().int().positive().nullable(),
    sentence: z.string().min(1).max(300),
    /** What Kenapa? reads: what Nemu saw that makes it a problem, when it can say more. */
    why: z.string().min(1).max(300).optional(),
  })
  .strict();

export const quizJudgeInputSchema = z
  .object({
    quiz: quizSnapshotSchema,
    /** The teacher's words, e.g. "Nemu, tolong cek kuis ini." */
    utterance: z.string().max(500),
    /** The problems the DOM rules already found, so a judgement doesn't repeat them. */
    found: z.array(quizProblemSchema).max(200),
  })
  .strict();

export const quizJudgementSchema = z
  .object({ problems: z.array(quizProblemSchema.extend({ kind: z.literal("judgement") })) })
  .strict();

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizSnapshot = z.infer<typeof quizSnapshotSchema>;
export type QuizProblem = z.infer<typeof quizProblemSchema>;
export type QuizJudgeInput = z.infer<typeof quizJudgeInputSchema>;
export type QuizJudgement = z.infer<typeof quizJudgementSchema>;

// --- F4-03: the teacher's script → a Moodle quiz (#210, #219) ----------------------------------

/** The teacher's script as she picked it: a PDF, a Word file or a photo, as a data URL. */
export const quizScriptFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    mimeType: z.string().max(120),
    /** About 15 MB of script at most. */
    dataUrl: z.string().min(1).max(20_000_000),
  })
  .strict();

export const quizScriptInputSchema = z
  .object({
    file: quizScriptFileSchema,
    /** Her words, e.g. "Masukkan kuis ini, buka Senin 7 Desember, tutup Kamis 10 Desember." */
    utterance: z.string().max(500),
    /** Her computer's date ("2026-12-01"), for "Senin" and a year she didn't say. */
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    /** The Moodle course the quiz goes into, as its page names it ("4A-UJI · Kelas 4A (uji)"). */
    course: z.string().max(255),
    /** The course's sections, in order ("Umum", "IPAS", "Bahasa Inggris"). */
    sections: z.array(z.string().max(255)).max(80),
  })
  .strict();

/** A picture taken from the script as it is: never drawn or described by Nemu. */
export const quizImageSchema = z
  .object({
    /** File name inside the Moodle XML ("soal-07-c.png"). */
    name: z.string().min(1).max(120),
    /** What a screen reader says ("Gambar (c)"). */
    alt: z.string().max(255),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    dataUrl: z.string().min(1).max(5_000_000),
  })
  .strict();

export const quizChoiceSchema = z
  .object({ text: z.string().max(2000), image: quizImageSchema.nullable() })
  .strict();

export const quizDraftQuestionSchema = z
  .object({
    /** The number on the script; the question is named "Soal 07" after it. */
    number: z.number().int().positive(),
    text: z.string().max(4000),
    image: quizImageSchema.nullable(),
    choices: z.array(quizChoiceSchema).min(2).max(10),
    /** Which choice is right (0 = a); null while the teacher hasn't said. */
    key: z.number().int().nonnegative().nullable(),
  })
  .strict();

/** A time she said: the date, and the clock time or null when she didn't say one. */
export const quizTimeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .nullable(),
  })
  .strict();

/** The quiz as read from the script and her words, before the teacher's answers. */
export const quizDraftSchema = z
  .object({
    /** "Latihan IPAS Kelas 4A": the script's title without the school's name. */
    name: z.string().min(1).max(255),
    /** The course section it goes into, as the course names it; null when Nemu must ask. */
    section: z.string().max(255).nullable(),
    /** The Moodle XML category ("$course$/top/IPAS 4A/Latihan IPAS Kelas 4A"). */
    category: z.string().max(500),
    opens: quizTimeSchema.nullable(),
    closes: quizTimeSchema.nullable(),
    questions: z.array(quizDraftQuestionSchema).max(200),
  })
  .strict();

/**
 * Something Nemu couldn't read on the script, asked the way F1 asks about a photo (Kartu Pilih):
 * one prompt, two or three options, never pre-selected, and she may also type or say another
 * answer where `options` aren't the only ones. Nemu never fills these in itself.
 */
export const quizScriptQuestionSchema = z.discriminatedUnion("kind", [
  /** A question's or choice's words. `choice` is null for the question's own text. */
  z
    .object({
      id: z.string(),
      kind: z.literal("text"),
      soal: z.number().int().positive(),
      choice: z.number().int().nonnegative().nullable(),
      prompt: z.string(),
      options: z.array(z.string()).max(3),
    })
    .strict(),
  /** The right answer: the script has no key for it, or the key can't be read. */
  z
    .object({
      id: z.string(),
      kind: z.literal("key"),
      soal: z.number().int().positive(),
      prompt: z.string(),
      /** Letters of the choices ("a", "b", "c", "d"); she may say one the card doesn't show. */
      options: z.array(z.string()).max(3),
    })
    .strict(),
  /** A picture the script shows that Nemu couldn't take out of it. */
  z
    .object({
      id: z.string(),
      kind: z.literal("image"),
      soal: z.number().int().positive(),
      choice: z.number().int().nonnegative().nullable(),
      prompt: z.string(),
      options: z.array(z.string()).min(2).max(3),
    })
    .strict(),
  /** Which section of the course the quiz goes into. */
  z
    .object({
      id: z.string(),
      kind: z.literal("section"),
      prompt: z.string(),
      options: z.array(z.string()).min(2).max(3),
    })
    .strict(),
]);

export const quizScriptResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      draft: quizDraftSchema,
      questions: z.array(quizScriptQuestionSchema),
    })
    .strict(),
  /** Nothing on the file reads as quiz questions; `message` is the one sentence Nemu says. */
  z.object({ status: z.literal("unreadable"), message: z.string() }).strict(),
]);

/** Her answer to one question: an option, or her own words. */
export const quizScriptAnswerSchema = z
  .object({ questionId: z.string(), answer: z.string().min(1).max(2000) })
  .strict();

export type QuizScriptFile = z.infer<typeof quizScriptFileSchema>;
export type QuizScriptInput = z.infer<typeof quizScriptInputSchema>;
export type QuizImage = z.infer<typeof quizImageSchema>;
export type QuizChoice = z.infer<typeof quizChoiceSchema>;
export type QuizDraftQuestion = z.infer<typeof quizDraftQuestionSchema>;
export type QuizTime = z.infer<typeof quizTimeSchema>;
export type QuizDraft = z.infer<typeof quizDraftSchema>;
export type QuizScriptQuestion = z.infer<typeof quizScriptQuestionSchema>;
export type QuizScriptResult = z.infer<typeof quizScriptResultSchema>;
export type QuizScriptAnswer = z.infer<typeof quizScriptAnswerSchema>;
