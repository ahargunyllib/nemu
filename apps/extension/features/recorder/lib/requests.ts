import type { NarrationSegment, RecordedEvent } from "@nemu/contracts/school";

/** What "Rekam cara" asks the background for (#214). */
export type RecorderRequest =
  | { op: "save"; title: string; events: RecordedEvent[]; narration: NarrationSegment[] }
  /** The recording so far for this tab, kept across page loads (F0-13). */
  | { op: "state-save"; state: unknown }
  | { op: "state-load" };

export type RecorderValue = {
  save: { recordingId: string; recordedBy: string };
  "state-save": null;
  "state-load": unknown;
};

export type RecorderResponse<Op extends RecorderRequest["op"]> =
  | { ok: true; value: RecorderValue[Op] }
  | { ok: false; message: string };
