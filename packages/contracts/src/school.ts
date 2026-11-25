import { z } from "zod";

/**
 * Wire contracts for Nemu v2.2 (AlurSekolah): grade books, stuck help, school knowledge and speech.
 * See docs/AI_TECHNICAL_PRD.md §2. Boxes are [x0, y0, x1, y1] on a 0–1000 scale of the source image.
 */

export const boxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type Box = z.infer<typeof boxSchema>;

export const absenceCodeSchema = z.enum(["S", "I", "A"]);
export const cellStatusSchema = z.enum(["value", "blank", "S", "I", "A"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const flagReasonSchema = z.enum([
  "models_disagree",
  "self_unsure",
  "struck",
  "initial",
  "out_of_range",
  "outlier",
  "zero_or_blank",
  "illegible",
  "absence",
  "reread_changed",
]);

export const gradeCellSchema = z
  .object({
    column: z.string().min(1),
    raw: z.string(),
    /** The accepted or suggested value; null while the teacher still has to answer, or for blank/S/I/A. */
    value: z.number().min(0).max(100).nullable(),
    status: cellStatusSchema,
    confidence: confidenceSchema,
    reasons: z.array(flagReasonSchema),
    readings: z
      .object({ a: z.string().nullable(), b: z.string().nullable(), reread: z.string().nullable() })
      .strict(),
    bbox: boxSchema.nullable(),
  })
  .strict();

export const nameCandidateSchema = z
  .object({ studentId: z.string(), name: z.string(), score: z.number() })
  .strict();

export const gradeRowSchema = z
  .object({
    line: z.number().int().positive(),
    nameRaw: z.string(),
    studentId: z.string().nullable(),
    rosterName: z.string().nullable(),
    nameScore: z.number(),
    nameStatus: z.enum(["auto", "ask", "unmatched"]),
    candidates: z.array(nameCandidateSchema),
    nameBox: boxSchema.nullable(),
    cells: z.array(gradeCellSchema),
  })
  .strict();

export const gradeSheetReadingSchema = z
  .object({
    source: z.enum(["photo", "excel"]),
    readable: z.boolean(),
    issues: z.array(z.string()),
    columns: z.array(z.object({ key: z.string(), label: z.string() }).strict()),
    rows: z.array(gradeRowSchema),
    /** Roster students no row was assigned to. */
    unmatchedStudents: z.array(z.object({ studentId: z.string(), name: z.string() }).strict()),
    /** Rows the parser skipped (title, average, totals), for the summary. */
    skippedRows: z.number().int().nonnegative(),
  })
  .strict();

export const verificationQuestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string(),
      kind: z.literal("digit"),
      line: z.number().int().positive(),
      column: z.string(),
      studentName: z.string(),
      prompt: z.string(),
      /** Readings to choose from, ascending; never pre-selected. Empty: the UI shows only "Angka lain". */
      options: z.array(z.string()),
      box: boxSchema.nullable(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      kind: z.literal("name"),
      line: z.number().int().positive(),
      nameRaw: z.string(),
      prompt: z.string(),
      options: z.array(nameCandidateSchema),
      box: boxSchema.nullable(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      kind: z.literal("absence"),
      line: z.number().int().positive(),
      column: z.string(),
      studentName: z.string(),
      code: absenceCodeSchema,
      prompt: z.string(),
      options: z.array(z.string()).min(1),
      box: boxSchema.nullable(),
    })
    .strict(),
]);

export const verificationPlanSchema = z
  .object({
    questions: z.array(verificationQuestionSchema),
    /** "22 nilai lain sudah cocok." */
    acceptedCount: z.number().int().nonnegative(),
    acceptedSentence: z.string(),
  })
  .strict();

/** The teacher's answer. For a digit: the value or "blank"; for a name: a studentId or "none"; for absence: "S" | "I" | "A" | a value. */
export const verificationAnswerSchema = z
  .object({ questionId: z.string(), answer: z.string().min(1).max(40) })
  .strict();

export const gradeEntrySchema = z
  .object({
    studentId: z.string(),
    name: z.string(),
    value: z.number().min(0).max(100).nullable(),
    status: cellStatusSchema,
    remedial: z.boolean(),
  })
  .strict();

export const schoolRuleKeySchema = z.enum([
  "school.kkm",
  "school.remedial_cap",
  "school.absence_blank",
  "school.input_deadline",
]);

export const gradeRulesResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      column: z.string(),
      entries: z.array(gradeEntrySchema),
      summary: z
        .object({
          filled: z.number().int(),
          blank: z.number().int(),
          remedial: z.number().int(),
        })
        .strict(),
      /** Rule key → active knowledge chunk id it cites. */
      citations: z.record(z.string(), z.string()),
      summarySentence: z.string(),
    })
    .strict(),
  z
    .object({
      status: z.literal("needs_source"),
      missing: z.array(schoolRuleKeySchema),
      sentence: z.string(),
    })
    .strict(),
  z
    .object({
      status: z.literal("unresolved"),
      /** Lines that still have an open question; answer them first. */
      lines: z.array(z.number().int()),
      sentence: z.string(),
    })
    .strict(),
]);

export const readbackRowSchema = z.object({ name: z.string(), value: z.string() }).strict();

export const readbackResultSchema = z
  .object({
    match: z.boolean(),
    mismatches: z.array(
      z
        .object({
          studentId: z.string(),
          name: z.string(),
          expected: z.string(),
          saved: z.string().nullable(),
        })
        .strict(),
    ),
    sentence: z.string(),
  })
  .strict();

export const gradeCommandSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      className: z.string(),
      subject: z.string(),
      assessment: z.string(),
    })
    .strict(),
  z.object({ status: z.literal("ask"), missing: z.string(), question: z.string() }).strict(),
]);

// --- F2: stuck help ---------------------------------------------------------------------------

export const screenElementSchema = z
  .object({
    name: z.string(),
    controlType: z.string(),
    rect: z
      .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
      .strict()
      .nullable(),
  })
  .strict();

/** What the extension reads from the page when Nemu is called: never input values, nothing at all when a password field shows. */
export const screenSnapshotSchema = z
  .object({
    title: z.string().max(500),
    url: z.string().max(2_000).nullable(),
    texts: z.array(z.string().max(2_000)).max(200),
    elements: z.array(screenElementSchema).max(300),
    /** JPEG, base64 without the data: prefix; ≤1280 px. Null when blocked or not captured. */
    screenshotBase64: z.string().nullable(),
    blocked: z.boolean(),
    blockedReason: z.enum(["password_field", "login_title"]).nullable(),
  })
  .strict();

export const sourceCitationSchema = z
  .object({
    chunkId: z.string(),
    docId: z.string(),
    title: z.string(),
    page: z.number().int().nullable(),
    article: z.string().nullable(),
    quote: z.string(),
  })
  .strict();

export const contactSchema = z
  .object({ name: z.string(), role: z.string(), phone: z.string() })
  .strict();

export const helpExplanationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("matched"),
      entryId: z.string(),
      /** The one bubble sentence: whose fault + the named person who can fix it. */
      sentence: z.string(),
      /** Shown behind "Kenapa?". */
      why: z.string(),
      teacherFault: z.boolean(),
      canSelfFix: z.boolean(),
      fixer: contactSchema.nullable(),
      /** Accessible name of the control to point at when the teacher can fix it. */
      guidedTarget: z.string().nullable(),
      citation: sourceCitationSchema,
      waDraft: z.object({ phone: z.string(), text: z.string() }).strict().nullable(),
    })
    .strict(),
  z
    .object({
      status: z.literal("not_in_guide"),
      sentence: z.string(),
      offerOperator: contactSchema.nullable(),
      waDraft: z.object({ phone: z.string(), text: z.string() }).strict().nullable(),
    })
    .strict(),
  z.object({ status: z.literal("blocked"), sentence: z.string() }).strict(),
]);

// --- F3: grounded answers, BPMN, procedures ----------------------------------------------------

export const groundedAnswerSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("answered"),
      answer: z.string(),
      citations: z.array(sourceCitationSchema).min(1),
    })
    .strict(),
  z.object({ status: z.literal("not_in_guide"), answer: z.string() }).strict(),
]);

export const bpmnStepSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("fill"),
      taskId: z.string(),
      fields: z.array(
        z.object({ fieldId: z.string(), label: z.string(), value: z.string() }).strict(),
      ),
      sentence: z.string(),
      because: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ask"),
      taskId: z.string(),
      slot: z.string(),
      question: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("human"),
      taskId: z.string(),
      action: z.string(),
      sentence: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("done"),
      taskId: z.string().nullable(),
      sentence: z.string(),
    })
    .strict(),
]);

export const bpmnPlanSchema = z
  .object({
    processId: z.string(),
    processName: z.string(),
    slots: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    /** Task ids in walk order, for the BPMN viewer highlight. */
    path: z.array(z.string()),
    activeTaskId: z.string().nullable(),
    step: bpmnStepSchema,
    stepIndex: z.number().int().nonnegative(),
    stepCount: z.number().int().nonnegative(),
  })
  .strict();

export const recordedEventSchema = z
  .object({
    t: z.number().nonnegative(),
    type: z.enum(["click", "input", "change", "navigate"]),
    url: z.string(),
    locator: z
      .object({
        role: z.string().nullable(),
        name: z.string().nullable(),
        label: z.string().nullable(),
        placeholder: z.string().nullable(),
        css: z.string().nullable(),
        relX: z.number().nullable(),
        relY: z.number().nullable(),
      })
      .strict(),
    value: z.string().nullable(),
  })
  .strict();

export const narrationSegmentSchema = z
  .object({ start: z.number().nonnegative(), end: z.number().nonnegative(), text: z.string() })
  .strict();

export const procedureStepSchema = z
  .object({
    id: z.string(),
    order: z.number().int().positive(),
    action: z.enum(["fill", "select", "click", "navigate"]),
    locator: recordedEventSchema.shape.locator,
    urlPattern: z.string(),
    /** "{{kelas}}" for a parameter, a literal otherwise, null for a click or navigation. */
    valueTemplate: z.string().nullable(),
    instruction: z.string(),
    requiresHumanAction: z.boolean(),
  })
  .strict();

export const procedureParameterSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string(),
    question: z.string(),
    example: z.string(),
  })
  .strict();

export const procedureSchema = z
  .object({
    title: z.string(),
    parameters: z.array(procedureParameterSchema),
    steps: z.array(procedureStepSchema),
  })
  .strict();

// --- Speech ------------------------------------------------------------------------------------

export const transcriptSchema = z.object({ text: z.string() }).strict();

export const spokenWordSchema = z
  .object({ text: z.string(), offsetMs: z.number(), durationMs: z.number() })
  .strict();

export const speechSynthesisSchema = z
  .object({
    audioBase64: z.string(),
    mimeType: z.string(),
    /** The exact text spoken; the bubble shows this same text (F0-05). */
    text: z.string(),
    words: z.array(spokenWordSchema),
    /**
     * "provider": offsets come from the TTS engine. "estimated": offsets assume `estimatedDurationMs`;
     * the client rescales them by (actual audio duration / estimatedDurationMs) once the audio loads.
     */
    timing: z.enum(["provider", "estimated"]),
    estimatedDurationMs: z.number(),
  })
  .strict();

// --- Commands ----------------------------------------------------------------------------------

export const voiceControlSchema = z.enum([
  "berhenti",
  "lanjut",
  "ulangi",
  "saya_saja",
  "ajari_saya",
]);

export const commandRouteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("control"), control: voiceControlSchema }).strict(),
  z
    .object({
      kind: z.literal("intent"),
      intent: z.enum(["input_nilai", "kenapa", "proses", "tanya", "unknown"]),
      /** For "proses": the matched process name. */
      processName: z.string().nullable(),
    })
    .strict(),
]);

// --- Inbox (photo jobs) ------------------------------------------------------------------------

export const inboxJobStatusSchema = z.enum(["queued", "processing", "ready", "reshoot", "failed"]);

export const inboxJobSchema = z
  .object({
    jobId: z.string(),
    source: z.enum(["whatsapp", "upload", "excel"]),
    status: inboxJobStatusSchema,
    createdAt: z.number(),
    reading: gradeSheetReadingSchema.nullable(),
    verification: verificationPlanSchema.nullable(),
    /** Plain-language reason for reshoot or failed. */
    message: z.string().nullable(),
  })
  .strict();

export type GradeCell = z.infer<typeof gradeCellSchema>;
export type GradeRow = z.infer<typeof gradeRowSchema>;
export type GradeSheetReading = z.infer<typeof gradeSheetReadingSchema>;
export type FlagReason = z.infer<typeof flagReasonSchema>;
export type NameCandidate = z.infer<typeof nameCandidateSchema>;
export type VerificationQuestion = z.infer<typeof verificationQuestionSchema>;
export type VerificationPlan = z.infer<typeof verificationPlanSchema>;
export type VerificationAnswer = z.infer<typeof verificationAnswerSchema>;
export type GradeEntry = z.infer<typeof gradeEntrySchema>;
export type SchoolRuleKey = z.infer<typeof schoolRuleKeySchema>;
export type GradeRulesResult = z.infer<typeof gradeRulesResultSchema>;
export type ReadbackRow = z.infer<typeof readbackRowSchema>;
export type ReadbackResult = z.infer<typeof readbackResultSchema>;
export type GradeCommand = z.infer<typeof gradeCommandSchema>;
export type ScreenElement = z.infer<typeof screenElementSchema>;
export type ScreenSnapshot = z.infer<typeof screenSnapshotSchema>;
export type SourceCitation = z.infer<typeof sourceCitationSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type HelpExplanation = z.infer<typeof helpExplanationSchema>;
export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>;
export type BpmnStep = z.infer<typeof bpmnStepSchema>;
export type BpmnPlan = z.infer<typeof bpmnPlanSchema>;
export type RecordedEvent = z.infer<typeof recordedEventSchema>;
export type NarrationSegment = z.infer<typeof narrationSegmentSchema>;
export type ProcedureStep = z.infer<typeof procedureStepSchema>;
export type ProcedureParameter = z.infer<typeof procedureParameterSchema>;
export type Procedure = z.infer<typeof procedureSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type SpokenWord = z.infer<typeof spokenWordSchema>;
export type SpeechSynthesis = z.infer<typeof speechSynthesisSchema>;
export type VoiceControl = z.infer<typeof voiceControlSchema>;
export type CommandRoute = z.infer<typeof commandRouteSchema>;
export type InboxJob = z.infer<typeof inboxJobSchema>;
export type InboxJobStatus = z.infer<typeof inboxJobStatusSchema>;
