import type {
  GradeCommand,
  GradeEntry,
  GradeRulesResult,
  GradeSheetReading,
  InboxJob,
  ReadbackResult,
  ReadbackRow,
  VerificationAnswer,
} from "@nemu/contracts/school";

/**
 * What the F1 flow in the page asks the background for (#207). The background alone calls the
 * Nemu Service, as the teacher whose email the page shows (ADR-0015).
 */
export type GradePhotoRequest =
  /** The photos this tab may show as a card (one tab only). */
  | { op: "poll" }
  /** The teacher started on this photo here: no other tab shows it. */
  | { op: "hold"; jobId: string }
  | { op: "release"; jobId: string }
  | { op: "command"; utterance: string }
  | { op: "process"; jobId: string; className: string; assessment: string | null }
  /** W5: the cell each question is about, cut from the photo (`null` where there is no box). */
  | { op: "crops"; jobId: string; boxes: (readonly [number, number, number, number] | null)[] }
  | { op: "finalize"; reading: GradeSheetReading; answers: VerificationAnswer[] }
  /**
   * F1-10: from AlurSekolah's API with the school's WS-07 key; when the school hasn't connected
   * it, from `saved`, the grades the page shows after the save.
   */
  | {
      op: "readback";
      entries: GradeEntry[];
      className: string;
      subject: string;
      assessment: string;
      saved: ReadbackRow[];
    }
  | { op: "ack"; jobId: string }
  /** The flow's state for this tab, kept across page loads (F0-13). */
  | { op: "state-save"; state: unknown }
  | { op: "state-load" };

export type GradePhotoValue = {
  poll: InboxJob[];
  hold: null;
  release: null;
  command: GradeCommand;
  process: InboxJob;
  crops: (string | null)[];
  finalize: GradeRulesResult;
  readback: ReadbackResult & { source: "alursekolah" | "page" };
  ack: { deleted: boolean };
  "state-save": null;
  "state-load": unknown;
};

/** Every answer: the value, or the sentence that says why there is none. */
export type GradePhotoResponse<Op extends GradePhotoRequest["op"]> =
  | { ok: true; value: GradePhotoValue[Op] }
  | { ok: false; message: string };
