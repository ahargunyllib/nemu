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
