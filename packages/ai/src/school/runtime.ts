import type {
  QuizJudgeInput,
  QuizJudgement,
  QuizScriptInput,
  QuizScriptResult,
} from "@nemu/contracts/quiz";
import type {
  GroundedAnswer,
  HelpExplanation,
  Procedure,
  SpeechSynthesis,
  Transcript,
} from "@nemu/contracts/school";

import { retrieveKnowledge } from "../knowledge.js";
import type { SlotValue } from "./bpmn/conditions.js";
import {
  matchFieldLabels,
  matchFields,
  type FieldMatch,
  type FieldToMatch,
} from "./bpmn/fields.js";
import {
  assembleFormPhoto,
  readFormPhoto,
  type FormPhotoInput,
  type FormPhotoReading,
} from "./bpmn/form-photo.js";
import type { ProcessGraph } from "./bpmn/graph.js";
import { extractSlots, resolveWeekday, slotSpecs, type ExtractSlotsInput } from "./bpmn/plan.js";
import { F1_DOUBTFUL, F1_REREAD, f1Page } from "./fixtures/f1-photo.js";
import { F4_2_READING, F4_2_SCRIPT_SHA256 } from "./fixtures/f4-2-script.js";
import { fixtureFormPhoto } from "./fixtures/form-photo.js";
import {
  parseGradeExcel,
  type ParseGradeExcelInput,
  type ParseGradeExcelResult,
} from "./grades/excel.js";
import {
  readGradePhoto,
  type ReadGradePhotoInput,
  type ReadGradePhotoResult,
} from "./grades/reading.js";
import {
  answerGrounded,
  normalizeForQuote,
  verifyGroundedAnswer,
  type AnswerGroundedInput,
} from "./grounding.js";
import { explainError, pageLines, resolveHelp, type ExplainErrorInput } from "./help.js";
import { createOpenRouterJsonCaller, type JsonCall, type JsonCallRequest } from "./llm.js";
import {
  documentationSymptoms,
  draftPhrasing,
  explainProcess,
  keywordSymptomMatch,
  matchSymptom,
  suggestSymptoms,
  type ExplainProcessInput,
  type SymptomCandidate,
} from "./process-help.js";
import {
  assembleProcedure,
  cleanRecording,
  compileProcedure,
  type CompileProcedureInput,
} from "./procedures.js";
import { fileBytes, readQuizScript } from "./quiz/script.js";
import {
  createOpenRouterSynthesizer,
  createOpenRouterTranscriber,
  localVoicePlan,
  type AudioInput,
} from "./speech.js";

/**
 * Every model-backed school capability behind one seam (ADR-0001): the Nemu Service calls these,
 * tests and `NEMU_RESPONDER=fixture` use `createFixtureSchoolAi`, which never touches the network.
 */
export type SchoolAi = {
  readGradePhoto(input: ReadGradePhotoInput): Promise<ReadGradePhotoResult>;
  parseGradeExcel(input: ParseGradeExcelInput): Promise<ParseGradeExcelResult>;
  explainError(input: ExplainErrorInput): Promise<HelpExplanation>;
  answerGrounded(input: AnswerGroundedInput): Promise<GroundedAnswer>;
  /** F3-11: on BPMN upload, the symptoms a user sees at each task and end event, by element id. */
  suggestSymptoms(input: { graph: ProcessGraph }): Promise<Record<string, string[]>>;
  /** F3-12: the stored symptom the teacher's words describe, or null (F3-14). */
  matchSymptom(input: {
    question: string;
    candidates: readonly SymptomCandidate[];
  }): Promise<SymptomCandidate | null>;
  /** F2-08 / F3-12..13: cause, way back, who helps and the parent reply; null if the walk fails. */
  explainProcess(input: ExplainProcessInput): Promise<HelpExplanation | null>;
  extractSlots(input: ExtractSlotsInput): Promise<Record<string, SlotValue>>;
  /** F3-16: a photo read against a BPMN task's fields; unreadable values become questions. */
  readFormPhoto(input: FormPhotoInput): Promise<FormPhotoReading>;
  /** F3-17: each BPMN form field → the page label it is, or null. */
  matchFields(input: {
    fields: readonly FieldToMatch[];
    pageLabels: readonly string[];
  }): Promise<FieldMatch>;
  compileProcedure(input: CompileProcedureInput): Promise<Procedure>;
  /**
   * F4-01: quiz checks that need judgement beyond the extension's DOM rules (#218), e.g. whether
   * a question suits the class. None is needed for F4-1 (#218), so both answer with no problems.
   */
  judgeQuiz(input: QuizJudgeInput): Promise<QuizJudgement>;
  /**
   * F4-03 (#219): the teacher's script (PDF, Word or photo) read into a quiz draft. Parts it
   * can't read come back as questions for her, in the shape of F1's photo questions.
   */
  readQuizScript(input: QuizScriptInput): Promise<QuizScriptResult>;
  transcribe(audio: AudioInput): Promise<Transcript>;
  /** Audio plus word timings; `audioBase64` is "" when the client must use its local voice. */
  synthesize(text: string): Promise<SpeechSynthesis>;
};

export type SchoolAiConfig = {
  apiKey: string;
  models: {
    /** Photo Read A: structure and coordinates (AI_TECHNICAL_PRD §8). */
    readA: string;
    /** Photo Read B: a different model family. */
    readB: string;
    reread: string;
    /** F4-03: the teacher's quiz script (a PDF as a file, or a photo), with its pictures. */
    script: string;
    /** Excel headers, help, grounded answers, slot extraction, procedure compile. */
    text: string;
    transcription: string;
    /** Empty: no TTS; the client speaks with the local OS voice. */
    speech: string;
    speechVoice: string;
  };
  /** Restrict every call to zero-data-retention endpoints (decision D1). */
  zdr: boolean;
  fetchImplementation?: typeof fetch;
};

export function createSchoolAi(config: SchoolAiConfig): SchoolAi {
  const caller = (model: string, reasoningEffort?: "low"): JsonCall =>
    createOpenRouterJsonCaller({
      apiKey: config.apiKey,
      model,
      zdr: config.zdr,
      fetchImplementation: config.fetchImplementation,
      ...(reasoningEffort ? { reasoningEffort } : {}),
    });
  const readers = {
    readA: caller(config.models.readA, "low"),
    readB: caller(config.models.readB, "low"),
    reread: caller(config.models.reread, "low"),
  };
  const text = caller(config.models.text);
  const synthesize = config.models.speech
    ? createOpenRouterSynthesizer({
        apiKey: config.apiKey,
        model: config.models.speech,
        voice: config.models.speechVoice,
        fetchImplementation: config.fetchImplementation,
      })
    : async (spoken: string): Promise<SpeechSynthesis> => ({
        audioBase64: "",
        mimeType: "",
        ...localVoicePlan(spoken),
      });

  return {
    readGradePhoto: (input) => readGradePhoto(readers, input),
    parseGradeExcel: (input) => parseGradeExcel({ mapHeaders: text }, input),
    explainError: (input) => explainError({ llm: text }, input),
    answerGrounded: (input) => answerGrounded({ llm: text }, input),
    suggestSymptoms: (input) => suggestSymptoms({ llm: text }, input),
    matchSymptom: (input) => matchSymptom({ llm: text }, input),
    explainProcess: (input) => explainProcess({ llm: text }, input),
    extractSlots: (input) => extractSlots(text, input),
    readFormPhoto: (input) => readFormPhoto(readers.readA, input),
    matchFields: (input) => matchFields({ llm: text }, input),
    compileProcedure: (input) => compileProcedure({ llm: text }, input),
    // #218: F4-1's problems are all caught by the extension's DOM rules, so no model check runs.
    judgeQuiz: async () => ({ problems: [] }),
    readQuizScript: (input) => readQuizScript({ llm: caller(config.models.script, "low") }, input),
    transcribe: createOpenRouterTranscriber({
      apiKey: config.apiKey,
      model: config.models.transcription,
      zdr: config.zdr,
      fetchImplementation: config.fetchImplementation,
    }),
    synthesize,
  };
}

/** A JsonCall that answers from code; it lets the offline mode reuse the real pipelines. */
function codeCall(answer: (request: JsonCallRequest<unknown>) => unknown): JsonCall {
  return (async <T>(request: JsonCallRequest<T>): Promise<T> =>
    request.parse(answer(request as JsonCallRequest<unknown>))) as JsonCall;
}

function requestText(request: JsonCallRequest<unknown>): string {
  return request.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

const FAMILY = /\b(anak|suami|istri|ibu saya|bapak saya|orang tua|keluarga|mertua)\b/iu;

/**
 * Offline school AI for development and UI work (`NEMU_RESPONDER=fixture`). Deterministic and
 * free: every photo reads as the synthetic F1-1 page, help matches by keyword, slots come from
 * simple rules. The real pipelines still run around these answers, so the shapes are real.
 */
export function createFixtureSchoolAi(): SchoolAi {
  // The page is written for the class the teacher named, so its names follow that roster.
  const photoReaders = (roster: ReadGradePhotoInput["roster"]) => ({
    readA: codeCall(() => f1Page(true, F1_DOUBTFUL, roster)),
    readB: codeCall(() => f1Page(false, {}, roster)),
    reread: codeCall((request) => {
      const ids = [...requestText(request).matchAll(/id=(\d+)/gu)].map((match) => match[1]!);
      return { cells: ids.map((id) => ({ id, value: F1_REREAD[id] ?? "?" })) };
    }),
  });

  return {
    readGradePhoto: (input) => readGradePhoto(photoReaders(input.roster), input),
    parseGradeExcel: (input) => parseGradeExcel({}, input),

    async explainError(input) {
      const words = (text: string) =>
        normalizeForQuote(text)
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
      const screen = words(pageLines(input.snapshot).join(" "));
      const entry = input.kamus.find((chunk) => {
        // A message with placeholders ("mengampu [mapel] di kelas [kelas]") matches up to the first.
        const quoted = chunk.text.match(/"([^"]+)"/u)?.[1]?.split(/[[…]/u)[0];
        return chunk.active && !!quoted?.trim() && screen.includes(words(quoted).slice(0, 40));
      });
      const sentences = entry?.text.split(/(?<=\.)\s+/u) ?? [];
      const fixerSentence =
        sentences.find((sentence) => /perlu|cukup|hubungi/iu.test(sentence)) ?? "";
      const role = /kepala sekolah/iu.test(fixerSentence)
        ? "kepsek"
        : /operator/iu.test(fixerSentence)
          ? "operator"
          : /guru cukup/iu.test(fixerSentence)
            ? "guru"
            : null;
      return resolveHelp(
        {
          status: entry ? "matched" : "not_in_guide",
          error_text: input.snapshot.alerts[0] ?? "",
          chunk_id: entry?.id ?? null,
          quote: fixerSentence.replace(/\.$/u, "") || null,
          teacher_fault: false,
          fixer_role: role,
          can_self_fix: role === "guru",
          // "… menekan tombol Sinkro Ruang GTK, lalu …" → "Sinkro Ruang GTK".
          guided_target:
            role === "guru"
              ? (fixerSentence.match(/tombol (.+?)(?=,|\.| lalu\b| di\b|$)/u)?.[1] ?? null)
              : null,
          why: entry ? sentences.slice(1).join(" ") : "",
          app_name: entry?.text.match(/^K-\d+ ([^:]+):/u)?.[1] ?? "aplikasi",
        },
        input.kamus.filter((chunk) => chunk.active),
        input,
      );
    },

    async answerGrounded(input) {
      const context = retrieveKnowledge(
        input.chunks.filter((chunk) => chunk.active),
        input.question,
        1,
      );
      const top = context[0];
      if (!top || top.score < 1)
        return { status: "not_in_guide", answer: "Belum ada di panduan sekolah." };
      // A guide section starts with its Markdown heading; the answer is the first sentence under it.
      const quote = top.text
        .replace(/^#{1,6}\s.*$/gmu, "")
        .trim()
        .split(/(?<=\.)\s+/u)[0]!
        .replace(/^\d+(\.\d+)*\s+/u, "")
        .replace(/\.$/u, "");
      return verifyGroundedAnswer(
        {
          status: "answered",
          answer: quote.length > 90 ? `${quote.slice(0, 87)}...` : `${quote}.`,
          citations: [{ chunk_id: top.id, quote }],
        },
        context,
      );
    },

    // Symptoms from the elements' own documentation, matching by shared words, drafts as written.
    suggestSymptoms: (input) =>
      suggestSymptoms(
        {
          llm: codeCall(() => ({
            elements: Object.entries(documentationSymptoms(input.graph)).map(
              ([element_id, symptoms]) => ({ element_id, symptoms }),
            ),
          })),
        },
        input,
      ),
    matchSymptom: (input) =>
      matchSymptom(
        { llm: codeCall(() => ({ index: keywordSymptomMatch(input.question, input.candidates) })) },
        input,
      ),
    explainProcess: (input) =>
      explainProcess({ llm: codeCall((request) => draftPhrasing(requestText(request))) }, input),

    async extractSlots(input) {
      return extractSlots(
        codeCall(() => {
          const answer: Record<string, SlotValue> = {};
          const text = input.text.toLocaleLowerCase("id-ID");
          for (const { name, field } of slotSpecs(input.graph, input.teacherLanes)) {
            answer[name] = null;
            if (field?.type === "enum") {
              const family = field.options.find((option) => /keluarga/iu.test(option.name));
              const sick = field.options.find((option) => /^sakit/iu.test(option.name));
              if (/\bsakit\b/u.test(text) && FAMILY.test(text) && family) answer[name] = family.id;
              else if (/\bsakit\b/u.test(text) && sick) answer[name] = sick.id;
              else
                answer[name] =
                  field.options.find((option) => text.includes(option.name.toLowerCase()))?.id ??
                  null;
            } else if (field?.type === "date") {
              answer[name] = resolveWeekday(text, input.today);
            } else if (field?.type === "long" && /\b(hari|lama)\b/iu.test(field.label)) {
              const days = text.match(/(\d+)\s*hari/u)?.[1];
              answer[name] = days ? Number(days) : resolveWeekday(text, input.today) ? 1 : null;
            } else if (field && /\bkelas\b/iu.test(field.label)) {
              // "… 4A hari ini": a class the way schools write one.
              answer[name] =
                text
                  .match(/\b(\d{1,2}\s?[a-f])\b/iu)?.[1]
                  ?.replace(/\s/gu, "")
                  .toUpperCase() ?? null;
            }
          }
          return answer;
        }),
        input,
      );
    },

    // The test photo carries its own reading (fixtures/form-photo.ts); the rest is the real code.
    async readFormPhoto(input) {
      return assembleFormPhoto(input, fixtureFormPhoto(input.image.dataUrl));
    },
    async matchFields(input) {
      return matchFieldLabels(input.fields, input.pageLabels);
    },

    // Every recorded value is a parameter (demo values change each time); the label names it.
    async compileProcedure(input) {
      const drafts = cleanRecording(input.events);
      const nameOf = (label: string) =>
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/gu, "_")
          .replace(/^_+|_+$/gu, "");
      const valued = (draft: (typeof drafts)[number]) =>
        (draft.action === "select" || draft.action === "fill") && !!draft.value;
      const parameters = drafts.filter(valued).map((draft) => ({
        name: nameOf(draft.label),
        label: draft.label,
        question: /^\d+$/u.test(draft.value ?? "")
          ? `${draft.label} berapa?`
          : `${draft.label} apa?`,
        example: draft.value ?? "",
      }));
      return assembleProcedure(input.title, drafts, {
        title: input.title,
        parameters,
        steps: drafts.map((draft, index) => ({
          index,
          value_template: valued(draft) ? `{{${nameOf(draft.label)}}}` : null,
          instruction: "",
        })),
      });
    },

    // The DOM rules find everything F4-1 needs; the offline runtime adds no judgement.
    async judgeQuiz() {
      return { problems: [] };
    },

    // Richard's F4-2 script reads as its own words; any other file reads as no questions.
    async readQuizScript(input) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        fileBytes(input.file.dataUrl) as BufferSource,
      );
      const hex = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const reading =
        hex === F4_2_SCRIPT_SHA256
          ? F4_2_READING
          : { readable: false, title: null, subject: null, class_name: null, questions: [] };
      return readQuizScript({ llm: codeCall(() => reading) }, input);
    },

    async transcribe() {
      return { text: "masukkan nilai UTS Matematika 4B" };
    },

    async synthesize(text) {
      return { audioBase64: "", mimeType: "", ...localVoicePlan(text) };
    },
  };
}
