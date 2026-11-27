import type { ActionLogEntry } from "@nemu/contracts/executor";
import {
  EXTENSION_HEADERS,
  type ExtensionConfig,
  type ExtensionIdentity,
} from "@nemu/contracts/extension";
import type {
  BpmnPlan,
  CommandRoute,
  FormPhotoResult,
  NarrationSegment,
  Procedure,
  RecordedEvent,
  FormTable,
  GradeCommand,
  GradeEntry,
  GradeRulesResult,
  GradeSheetReading,
  GroundedAnswer,
  HelpExplanation,
  InboxJob,
  PageSnapshot,
  ReadbackResult,
  ReadbackRow,
  SpeechSynthesis,
  Transcript,
  VerificationAnswer,
} from "@nemu/contracts/school";
import { type Client, createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { serverUrl } from "../lib/config";

type Call<Input, Output> = Client<Record<never, never>, Input, Output, Error>;

/** The procedures the extension calls; their schemas come from `@nemu/contracts`. */
export type NemuServiceClient = {
  extensionConfig: Call<undefined, ExtensionConfig>;
  extensionIdentify: Call<undefined, ExtensionIdentity>;
  helpRoute: Call<{ utterance: string }, CommandRoute>;
  helpAsk: Call<{ question: string }, GroundedAnswer>;
  helpExplain: Call<{ snapshot: PageSnapshot; question: string | null }, HelpExplanation>;
  speechTranscribe: Call<{ audioBase64: string; format: "wav" | "webm" }, Transcript>;
  speechSynthesize: Call<{ text: string }, SpeechSynthesis>;
  actionLogRecord: Call<{ entries: ActionLogEntry[] }, { recorded: number }>;
  // F1 (#207): the WhatsApp photo, its verification, the rules, and the read-back.
  inboxJobs: Call<undefined, InboxJob[]>;
  inboxProcess: Call<{ jobId: string; className: string; assessment: string | null }, InboxJob>;
  inboxPhoto: Call<{ jobId: string }, Blob>;
  inboxAck: Call<{ jobId: string }, { deleted: boolean }>;
  gradesParseCommand: Call<{ utterance: string }, GradeCommand>;
  gradesFinalize: Call<
    { reading: GradeSheetReading; answers: VerificationAnswer[] },
    GradeRulesResult
  >;
  gradesReadbackAlurSekolah: Call<
    { entries: GradeEntry[]; className: string; subject: string; assessment: string },
    ReadbackResult
  >;
  gradesReadback: Call<{ entries: GradeEntry[]; saved: ReadbackRow[] }, ReadbackResult>;
  gradesGuidedLine: Call<
    { entries: GradeEntry[]; studentId: string; typed: string | null },
    { sentence: string; ok: boolean | null }
  >;
  // F3 (#213): a process the school uploaded as BPMN, run from the teacher's words and a photo.
  processList: Call<undefined, Array<{ documentId: string; title: string; version: string }>>;
  processPlan: Call<ProcessPlanInput, BpmnPlan & { documentId: string }>;
  processReadPhoto: Call<
    { documentId: string; jobId: string; taskId: string; slots: ProcessSlots },
    FormPhotoResult
  >;
  // F3-01 (#214): "Rekam cara" and replaying a recorded procedure.
  procedureRecordingSave: Call<
    { title: string; events: RecordedEvent[]; narration: NarrationSegment[] },
    { recordingId: string; recordedBy: string }
  >;
  procedureList: Call<undefined, Array<{ documentId: string; title: string; version: string }>>;
  procedureRun: Call<
    { documentId: string; values: Record<string, string> },
    | {
        status: "ok";
        title: string;
        recordedBy: string | null;
        steps: Array<Procedure["steps"][number] & { value: string | null }>;
      }
    | {
        status: "missing";
        title: string;
        recordedBy: string | null;
        parameter: Procedure["parameters"][number];
      }
  >;
  processMatchFields: Call<
    { fields: Array<{ id: string; label: string }>; pageLabels: string[] },
    Record<string, string | null>
  >;
};

export type ProcessSlots = Record<string, string | number | boolean | null>;

export type ProcessPlanInput = {
  documentId: string;
  text: string | null;
  answering: string | null;
  slots: ProcessSlots;
  stepIndex: number;
  table?: FormTable | null;
};

export type ExtensionCredentials = { installCode: string; email?: string | null };

/**
 * A client that proves who is asking with the install code and the page email instead of a login
 * (ADR-0015). Extension pages and the background call the Nemu Service under the manifest's host
 * permission, so CORS never applies.
 */
export function createNemuServiceClient(credentials: ExtensionCredentials): NemuServiceClient {
  const headers: Record<string, string> = {
    [EXTENSION_HEADERS.installCode]: credentials.installCode,
  };
  if (credentials.email) headers[EXTENSION_HEADERS.email] = credentials.email;
  return createORPCClient(new RPCLink({ url: `${serverUrl()}/rpc`, headers }));
}

/** The sentence to show for a failed call: the service's own Indonesian refusal, or a network one. */
export function failureMessage(error: unknown): string {
  if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR" && error.message) {
    return error.message;
  }
  return "Nemu belum bisa dihubungi. Coba lagi sebentar lagi.";
}

/** Whether the Nemu Service refused the install code itself, so the settings need a new one. */
export function isInvalidInstallCode(error: unknown): boolean {
  return (
    error instanceof ORPCError &&
    error.code === "UNAUTHORIZED" &&
    (error.data as { reason?: string } | undefined)?.reason === "invalid_install_code"
  );
}
