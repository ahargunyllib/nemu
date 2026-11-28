import { z } from "zod";

/**
 * The executor's step list (PRD §6.1, #202). Every task Nemu does on a page (grade entries, BPMN
 * steps, recordings, Moodle setup) becomes these steps, and the Nemu Extension runs them with its
 * own safety rules (F0-06/07/08). Targets are found by label, role and text, never by pixels.
 */

export const targetRoleSchema = z.enum([
  "textbox",
  "combobox",
  "checkbox",
  "radio",
  "button",
  "link",
  "menuitem",
  "tab",
]);

/**
 * A page element as a person would name it: its label (accessible name), its role, the text it
 * shows, or the table cell in a row (`row`, e.g. the student's name) under a column header.
 * `near` picks, among controls with the same name, the one in the part of the page that shows
 * that text, e.g. the "Edit" menu of the activity "Latihan: My Family (has/have)" on a Moodle
 * course page.
 * `group` names the fieldset (by its legend) or ARIA group it sits in, for fields whose own
 * label repeats, e.g. Moodle's "Hari" under both "Kuis dimulai" and "Tutup kuis".
 */
export const executorTargetSchema = z
  .object({
    label: z.string().min(1).optional(),
    role: targetRoleSchema.optional(),
    text: z.string().min(1).optional(),
    row: z.string().min(1).optional(),
    column: z.string().min(1).optional(),
    near: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
  })
  .strict()
  .refine((target) => target.label || target.text || target.row, {
    message: "A target needs a label, a text or a row",
  });

/**
 * The recipe line a step belongs to (F1·12): the plan names its stages ("Menu Nilai",
 * "Pilih kelas, mapel, penilaian", "Ketik nilai per murid", "Tekan Simpan"), and Catatan langkah
 * lists them in order, once each, as "Cara …". A step without one gets a plain line from its verb.
 */
const stage = z.string().min(1).max(80).optional();

export const executorStepSchema = z.discriminatedUnion("verb", [
  /**
   * The teacher's turn: Nemu points and waits for her to press it (Simpan, Kirim, uploads).
   * `ringkasan` is what Lihat ringkasan shows beside it, e.g. the grades about to be saved.
   */
  z
    .object({
      verb: z.literal("point"),
      stage,
      target: executorTargetSchema,
      sentence: z.string(),
      ringkasan: z.string().max(4000).optional(),
      /** Where this step came from, behind Sumber: "Rekaman Pak Rizal, langkah 11 dari 11". */
      sumber: z.string().max(200).optional(),
    })
    .strict(),
  /** Types a value into a field. `rowName` (the student) is what Nemu says with it. */
  z
    .object({
      verb: z.literal("setValue"),
      stage,
      target: executorTargetSchema,
      value: z.string(),
      rowName: z.string().optional(),
    })
    .strict(),
  z
    .object({
      verb: z.literal("selectOption"),
      stage,
      target: executorTargetSchema,
      option: z.string(),
    })
    .strict(),
  z
    .object({
      verb: z.literal("check"),
      stage,
      target: executorTargetSchema,
      checked: z.boolean().default(true),
    })
    .strict(),
  z.object({ verb: z.literal("scroll"), stage, target: executorTargetSchema }).strict(),
  /** Visible navigation (F0-13): Nemu clicks a menu, link or tab with the cursor, naming it. */
  z.object({ verb: z.literal("clickMenu"), stage, target: executorTargetSchema }).strict(),
]);

/** The six step verbs; anything else a model or recording sends is never run (F0-08). */
export const EXECUTOR_VERBS = [
  "point",
  "setValue",
  "selectOption",
  "check",
  "scroll",
  "clickMenu",
] as const;

/**
 * What Catatan langkah calls the job: `name` for every run of it ("Isi nilai kelas" → "Cara isi
 * nilai kelas"), `from` for this run ("pengisian Matematika 4B" → "Disimpan dari pengisian
 * Matematika 4B, 1 Des 2026."). Without it the task's title stands in for both.
 */
export const executorRecipeSchema = z
  .object({ name: z.string().min(1).max(80), from: z.string().min(1).max(120).optional() })
  .strict();

/** One task for the executor. `kind` groups runs of the same job, e.g. for "Coba sendiri". */
export const executorTaskSchema = z
  .object({
    kind: z.string().min(1),
    title: z.string().min(1),
    /** Where the steps came from, shown in Catatan langkah ("Rekaman Pak Rizal"). */
    source: z.string().optional(),
    recipe: executorRecipeSchema.optional(),
    steps: z.array(executorStepSchema),
  })
  .strict();

/**
 * A step as a model or recording sends it, before the extension checks it. Anything that isn't
 * one of the allowed verbs (a "click", "submit" or "pressKey") is turned into pointing (F0-08).
 */
export const untrustedStepSchema = z
  .object({ verb: z.string(), target: z.unknown().optional() })
  .passthrough();

export const untrustedTaskSchema = z
  .object({
    kind: z.string().min(1),
    title: z.string().min(1),
    source: z.string().optional(),
    steps: z.array(untrustedStepSchema),
  })
  .passthrough();

// --- Action log (WS-10) -----------------------------------------------------------------------

/** What happened to one Nemu action. `teacher` is a step left to the teacher (point). */
export const actionResultSchema = z.enum(["done", "refused", "teacher", "stopped", "failed"]);

/**
 * One row of the action log: what Nemu did, where and how it ended. It names the target, never
 * the value typed into it, so no grade ever reaches the log.
 */
export const actionLogEntrySchema = z
  .object({
    /** The page's host, e.g. `nemu-alursekolah.ahargunyllib.dev`. */
    website: z.string().min(1).max(253),
    task: z.string().min(1).max(200),
    action: z.enum([...EXECUTOR_VERBS, "start", "finish", "stop"]),
    /** The target's accessible name ("Nilai Budi Santoso"), or "" for start/finish/stop. */
    target: z.string().max(200),
    cara: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    result: actionResultSchema,
    at: z.number().int().nonnegative(),
  })
  .strict();

export const actionLogRecordInputSchema = z
  .object({ entries: z.array(actionLogEntrySchema).min(1).max(100) })
  .strict();

export type TargetRole = z.infer<typeof targetRoleSchema>;
export type ExecutorTarget = z.infer<typeof executorTargetSchema>;
export type ExecutorStep = z.infer<typeof executorStepSchema>;
export type ExecutorVerb = ExecutorStep["verb"];
export type ExecutorTask = z.infer<typeof executorTaskSchema>;
export type ExecutorRecipe = z.infer<typeof executorRecipeSchema>;
export type UntrustedStep = z.infer<typeof untrustedStepSchema>;
export type UntrustedTask = z.infer<typeof untrustedTaskSchema>;
export type ActionResult = z.infer<typeof actionResultSchema>;
export type ActionLogEntry = z.infer<typeof actionLogEntrySchema>;
