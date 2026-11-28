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
      .object({
        a: z.string().nullable(),
        b: z.string().nullable(),
        reread: z.string().nullable(),
        /** Other values a reader said the digits could be ("71" for a hooked 1 read as 77). */
        alternatives: z.array(z.string()).optional(),
      })
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
      /** "Ajari saya ngisi nilai sendiri": she asked to be taught, so the fill starts in cara 2. */
      cara: z.literal(2).optional(),
    })
    .strict(),
  z.object({ status: z.literal("ask"), missing: z.string(), question: z.string() }).strict(),
]);

// --- F2: stuck help ---------------------------------------------------------------------------

/**
 * A choice the page shows: a select's label and chosen option, or a checkbox or radio and whether
 * it is ticked. Never a typed field (a grade, a note) and never a field in a table row (#255).
 */
export const pageFieldSchema = z
  .object({ label: z.string().max(300), value: z.string().max(500) })
  .strict();

/**
 * What the Nemu Extension reads from the page for "ini kenapa?" (#216): the title and address,
 * alerts, toasts and error messages, headings, the choices made in its form fields, and a
 * viewport screenshot. No UIA text, no window bounds. When a password field is on screen the
 * extension sends nothing at all, so the Nemu Service never sees a blocked snapshot.
 */
export const pageSnapshotSchema = z
  .object({
    title: z.string().max(500),
    url: z.string().max(2_000),
    /** `role=alert` text, toasts (`role=status`, `aria-live`) and error messages. */
    alerts: z.array(z.string().max(2_000)).max(30),
    headings: z.array(z.string().max(300)).max(50),
    fields: z.array(pageFieldSchema).max(150),
    /** JPEG of the visible viewport (`captureVisibleTab`), base64 without the data: prefix; ≤1280 px. */
    screenshotBase64: z.string().max(4_000_000).nullable(),
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

/** Sumber (#258): a short-lived signed path, on the Nemu Service, to a cited PDF. */
export const documentFileLinkSchema = z
  .object({ path: z.string().startsWith("/"), expiresAt: z.number().int() })
  .strict();

export const contactSchema = z
  .object({ name: z.string(), role: z.string(), phone: z.string() })
  .strict();

const processStepsSchema = z
  .array(z.object({ text: z.string(), elementIds: z.array(z.string()).min(1) }).strict())
  .min(2)
  .max(4);

const symptomRefSchema = z
  .object({ elementId: z.string().min(1), symptom: z.string().min(1).max(300) })
  .strict();

/** #308: a BPMN symptom match (and what happened first) that a later call can reuse. */
export const processMatchSchema = z
  .object({
    documentId: z.string().min(1),
    match: symptomRefSchema,
    via: symptomRefSchema.nullable(),
  })
  .strict();

/** #308: what `helpExplainDetails` needs to walk the same BPMN again without matching again. */
export const processDetailsRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    documentId: z.string().min(1),
    match: symptomRefSchema,
    via: symptomRefSchema.nullable(),
  })
  .strict();

/** #308: the parts of a process explanation that `answerFirst` leaves as the code's drafts. */
export const processDetailsSchema = z
  .object({ why: z.string(), steps: processStepsSchema, parentReply: z.string().nullable() })
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
      /**
       * The control to point at when the teacher can fix it, by the name the page shows (its
       * label or text), so the extension finds it by label, role or text.
       */
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
  /**
   * F2-08 / F3-12: the teacher's question matched a symptom of an uploaded BPMN, and the walk found
   * the cause and the way back. About one pupil, `sentence` says the cause is "kemungkinan": only
   * her grades can be checked, never what the process depends on (F3-13).
   */
  z
    .object({
      status: z.literal("process"),
      sentence: z.string(),
      why: z.string(),
      process: z
        .object({ documentId: z.string(), title: z.string(), version: z.string() })
        .strict(),
      /** The task or end event the symptom belongs to; highlighted in Lihat diagram. */
      elementId: z.string(),
      /** Sumber for the teacher: 2–4 plain-language steps, each with its BPMN element ids. */
      steps: processStepsSchema,
      fixer: contactSchema.nullable(),
      /** A polite WhatsApp reply the teacher sends the parent herself: no amounts, no "tunggakan". */
      parentReply: z.string().nullable(),
      /**
       * #308, only when `helpExplain` was asked `answerFirst`: `why`, `steps` and `parentReply`
       * are the code's drafts; send this to `helpExplainDetails` for them in plain words.
       */
      detailsRequest: processDetailsRequestSchema.optional(),
    })
    .strict(),
  /** F3-13: AlurSekolah says the student's grades aren't saved, so the process isn't the cause. */
  z
    .object({ status: z.literal("grades_not_saved"), sentence: z.string(), student: z.string() })
    .strict(),
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

/** One row of a form table: who it is and the value of each repeating field, by field id. */
export const formTableRowSchema = z
  .object({ name: z.string().min(1).max(120), values: z.record(z.string(), z.string().max(200)) })
  .strict();

/** The repeating part of a BPMN task's form, as read from a photo and checked by the teacher. */
export const formTableSchema = z
  .object({
    keyField: z.string().max(80).nullable(),
    columns: z.array(z.string().max(80)).max(40),
    rows: z.array(formTableRowSchema).max(60),
  })
  .strict();

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
  /**
   * F3-15..17: the task's fields that repeat once per row (a photo of a book with one line per
   * student), filled into the page table by the row's name and the column's label.
   */
  z
    .object({
      kind: z.literal("rows"),
      taskId: z.string(),
      /** The field that names each row ("Murid"); it is the row, not a value to fill. */
      keyField: z.string().nullable(),
      columns: z.array(z.object({ fieldId: z.string(), label: z.string() }).strict()),
      rows: z.array(formTableRowSchema),
      sentence: z.string(),
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

/** F3-19: where a teacher task's page came from. Without one Nemu only explains (cara 3). */
export const processPageSourceSchema = z.enum(["link", "mapping", "recording"]);

/** A teacher task on the walked path: its page (a menu path such as "Al-Quran › Setoran baru"). */
export const processPlanTaskSchema = z
  .object({
    taskId: z.string(),
    name: z.string(),
    page: z.string().nullable(),
    pageSource: processPageSourceSchema.nullable(),
    /** The button only the teacher presses at the end of the task ("Simpan setoran", "Ajukan"). */
    action: z.string(),
  })
  .strict();

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
    /** Every step of the walk so far, in order; it ends with an `ask` or the `done`. */
    steps: z.array(bpmnStepSchema),
    /** F3-15: 2–6 plain-language steps shown before Nemu does anything. */
    overview: z.array(z.string()).min(2).max(6),
    tasks: z.array(processPlanTaskSchema),
    /** F3-18: other roles' and the system's tasks after the teacher's part; Nemu only names them. */
    announcements: z.array(z.string()),
  })
  .strict();

/** One question about the photo: a value Nemu couldn't read, or a name it couldn't place. */
export const formPhotoQuestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("value"),
      id: z.string(),
      rowName: z.string(),
      fieldId: z.string(),
      label: z.string(),
      prompt: z.string(),
      /** What the value might be, most likely first; never pre-selected. */
      candidates: z.array(z.string()).max(2),
      box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("name"),
      id: z.string(),
      /** The row's name as written, until the teacher picks one from the roster. */
      rowName: z.string(),
      prompt: z.string(),
      candidates: z.array(z.string()).max(2),
      box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
    })
    .strict(),
]);

/** F3-16: a photo read against a BPMN task's fields: header values, rows, and what to ask. */
export const formPhotoResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      taskId: z.string(),
      /** The slots so far plus header values read from the photo (a date written at the top). */
      slots: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      table: formTableSchema,
      questions: z.array(formPhotoQuestionSchema),
    })
    .strict(),
  z.object({ status: z.literal("reshoot"), message: z.string() }).strict(),
]);

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
    /** Who recorded it, as Nemu says it: "Pak Rizal" (F3-01, "Rekaman Pak Rizal"). */
    recordedBy: z.string().max(80).optional(),
  })
  .strict();

/** F3-01: what "Rekam cara" captured in the extension, kept until the operator reviews it. */
export const procedureRecordingSchema = z
  .object({
    recordingId: z.string(),
    title: z.string(),
    recordedBy: z.string(),
    events: z.array(recordedEventSchema),
    narration: z.array(narrationSegmentSchema),
    createdAt: z.number().int(),
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
  "pelan",
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
      /**
       * #308: for "kenapa", the symptom the route already matched with the model; pass it to
       * `helpExplain` so it doesn't match again.
       */
      processMatch: processMatchSchema.optional(),
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

/**
 * #269: what the grade-book photo's heading says ("UTS Matematika 4B"), read before the full read
 * so Nemu can ask "Ini nilai apa, Bu?" with it as the choices (#270). Most likely first; empty
 * when the heading can't be read, and Nemu then asks her to say or type it.
 */
export const photoTitleCandidateSchema = z
  .object({
    /** As the heading writes it: "UTS", "UH 2", "Tugas". */
    assessment: z.string().min(1),
    subject: z.string().min(1),
    /** null when the heading names no class: Nemu asks for it after she picks. */
    className: z.string().min(1).nullable(),
  })
  .strict();

export const photoTitleSchema = z
  .object({ candidates: z.array(photoTitleCandidateSchema).max(3) })
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
export type PageField = z.infer<typeof pageFieldSchema>;
export type PageSnapshot = z.infer<typeof pageSnapshotSchema>;
export type SourceCitation = z.infer<typeof sourceCitationSchema>;
export type DocumentFileLink = z.infer<typeof documentFileLinkSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type HelpExplanation = z.infer<typeof helpExplanationSchema>;
export type ProcessMatch = z.infer<typeof processMatchSchema>;
export type ProcessDetailsRequest = z.infer<typeof processDetailsRequestSchema>;
export type ProcessDetails = z.infer<typeof processDetailsSchema>;
export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>;
export type BpmnStep = z.infer<typeof bpmnStepSchema>;
export type ProcedureRecording = z.infer<typeof procedureRecordingSchema>;
export type BpmnPlan = z.infer<typeof bpmnPlanSchema>;
export type FormTableRow = z.infer<typeof formTableRowSchema>;
export type FormTable = z.infer<typeof formTableSchema>;
export type ProcessPageSource = z.infer<typeof processPageSourceSchema>;
export type ProcessPlanTask = z.infer<typeof processPlanTaskSchema>;
export type FormPhotoQuestion = z.infer<typeof formPhotoQuestionSchema>;
export type FormPhotoResult = z.infer<typeof formPhotoResultSchema>;
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
export type PhotoTitleCandidate = z.infer<typeof photoTitleCandidateSchema>;
export type PhotoTitle = z.infer<typeof photoTitleSchema>;
