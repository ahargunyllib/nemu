import type { BpmnPlan, FormPhotoResult, InboxJob } from "@nemu/contracts/school";

import type {
  NemuServiceClient,
  ProcessPlanInput,
  ProcessSlots,
} from "../../../shared/api/nemu-service";

/**
 * What the F3 flow in the page asks the background for (#213). The background alone calls the
 * Nemu Service, as the teacher whose email the page shows (ADR-0015).
 */
export type ProcessRunRequest =
  /** The active BPMN or recorded procedure `helpRoute` named ("Catat Hafalan Tahfidz"), or null. */
  | { op: "find"; processName: string }
  /** F3-01 replay: the recorded steps with the teacher's values, or the next value to ask for. */
  | { op: "run-procedure"; documentId: string; values: Record<string, string> }
  | { op: "plan"; input: ProcessPlanInput }
  /** Photos waiting in the teacher's inbox (WhatsApp or upload), newest first. */
  | { op: "jobs" }
  /** F3·03: the waiting photo's thumbnail for the start card, before Mulai; null without one. */
  | { op: "thumbnail"; jobId: string }
  | { op: "read-photo"; documentId: string; jobId: string; taskId: string; slots: ProcessSlots }
  /** The cell each question is about, cut from the photo (`null` where there is no box). */
  | { op: "crops"; jobId: string; boxes: (readonly [number, number, number, number] | null)[] }
  | { op: "match-fields"; fields: Array<{ id: string; label: string }>; pageLabels: string[] }
  | { op: "ack"; jobId: string }
  /** The flow's state for this tab, kept across page loads (F0-13). */
  | { op: "state-save"; state: unknown }
  | { op: "state-load" };

export type ProcessRunValue = {
  find: { documentId: string; title: string; kind: "bpmn" | "procedure" } | null;
  "run-procedure": Awaited<ReturnType<NemuServiceClient["procedureRun"]>>;
  plan: BpmnPlan & { documentId: string };
  jobs: InboxJob[];
  thumbnail: string | null;
  "read-photo": FormPhotoResult;
  crops: (string | null)[];
  "match-fields": Record<string, string | null>;
  ack: { deleted: boolean };
  "state-save": null;
  "state-load": unknown;
};

/** Every answer: the value, or the sentence that says why there is none. */
export type ProcessRunResponse<Op extends ProcessRunRequest["op"]> =
  | { ok: true; value: ProcessRunValue[Op] }
  | { ok: false; message: string };
