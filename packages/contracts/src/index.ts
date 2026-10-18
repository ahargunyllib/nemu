import { z } from "zod";

export const nemuIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9:_-]+$/, "nemu_id contains unsupported characters");

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const pageElementSchema = z
  .object({
    nemu_id: nemuIdSchema,
    label: z.string().min(1).max(500),
    role: z.string().min(1).max(80),
    visible: z.boolean(),
    position: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().nonnegative(),
        height: z.number().finite().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const processContextSchema = z
  .object({
    instance_id: z.string().min(1).max(160),
    active_task: z.string().min(1).max(160).optional(),
    status: z.string().min(1).max(120).optional(),
    return_date: isoDateSchema.optional(),
    destination_province: z.string().min(1).max(120).optional(),
    nights: z.number().int().nonnegative().max(365).optional(),
    uploaded_documents: z.array(z.string().min(1).max(200)).max(100).default([]),
  })
  .strict();

export const nemuRequestSchema = z
  .object({
    session_id: z.string().min(1).max(160),
    user_id: z.string().min(1).max(160).optional(),
    url: z.url(),
    prompt: z.string().trim().min(1).max(4_000),
    screenshot_crop: z.string().min(1).max(7_000_000).optional(),
    elements: z.array(pageElementSchema).max(150),
    process_context: processContextSchema.optional(),
  })
  .strict();

export const citationSchema = z
  .object({
    doc_id: z.string().min(1).max(200),
    judul: z.string().min(1).max(300),
    pasal: z.string().min(1).max(160).optional(),
    halaman: z.number().int().positive().optional(),
  })
  .strict();

const calculationValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const calculationSchema = z
  .object({
    fungsi: z.enum([
      "lookup_sbm",
      "hitung_lumpsum_penginapan",
      "uang_harian",
      "batas_pertanggungjawaban",
      "sisa_hari_kerja",
    ]),
    input: z.record(z.string(), calculationValueSchema),
    hasil: calculationValueSchema,
    sumber: z.string().min(1).max(300).optional(),
  })
  .strict();

export const actionTypeSchema = z.enum(["click", "highlight", "confirm"]);
export const actionLevelSchema = z.enum(["jalan_sendiri", "arahkan", "konfirmasi"]);

export const nemuActionSchema = z
  .object({
    type: actionTypeSchema,
    target: nemuIdSchema,
    level: actionLevelSchema,
    label: z.string().min(1).max(120),
  })
  .strict()
  .superRefine((action, context) => {
    if (action.type === "click" && action.level !== "jalan_sendiri") {
      context.addIssue({
        code: "custom",
        message: "A click action requires the jalan_sendiri level",
        path: ["level"],
      });
    }

    if (action.type === "confirm" && action.level !== "konfirmasi") {
      context.addIssue({
        code: "custom",
        message: "A confirm action requires the konfirmasi level",
        path: ["level"],
      });
    }
  });

export const nemuAnswerSchema = z
  .object({
    ringkas: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine((value) => value.split(/\s+/u).length <= 40, "Summary must not exceed 40 words"),
    detail: z.string().trim().max(6_000).optional(),
  })
  .strict();

export const timingSchema = z
  .object({
    jev_ms: z.number().int().nonnegative().optional(),
    retrieval_ms: z.number().int().nonnegative().optional(),
    tools_ms: z.number().int().nonnegative().optional(),
    gpt_ms: z.number().int().nonnegative().optional(),
    total_ms: z.number().int().nonnegative(),
  })
  .strict();

export const nemuResponseSchema = z
  .object({
    status: z.enum(["answer", "clarify", "refuse", "error"]),
    answer: nemuAnswerSchema,
    citations: z.array(citationSchema).max(20),
    calc: z.array(calculationSchema).max(20),
    actions: z.array(nemuActionSchema).max(20),
    warnings: z.array(z.string().min(1).max(500)).max(20),
    timing: timingSchema.optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if ((response.status === "refuse" || response.status === "error") && response.actions.length) {
      context.addIssue({
        code: "custom",
        message: `${response.status} responses cannot contain actions`,
        path: ["actions"],
      });
    }
  });

export type PageElement = z.infer<typeof pageElementSchema>;
export type ProcessContext = z.infer<typeof processContextSchema>;
export type NemuRequest = z.infer<typeof nemuRequestSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Calculation = z.infer<typeof calculationSchema>;
export type NemuAction = z.infer<typeof nemuActionSchema>;
export type NemuAnswer = z.infer<typeof nemuAnswerSchema>;
export type NemuResponse = z.infer<typeof nemuResponseSchema>;
