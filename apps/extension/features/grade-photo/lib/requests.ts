import type {
  GradeCommand,
  GradeEntry,
  GradeRulesResult,
  GradeSheetReading,
  InboxJob,
  PhotoTitle,
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
  /** #278: the card's thumbnail as a data URL, before Mulai; null when the photo has none. */
  | { op: "thumbnail"; jobId: string }
  /** #269: the photo's heading, read before the full read, for "Ini nilai apa, Bu?" (#270). */
  | { op: "title"; jobId: string }
  | { op: "command"; utterance: string }
  | { op: "process"; jobId: string; className: string; assessment: string | null }
  /** W5: the cell each question is about, cut from the photo (`null` where there is no box). */
  | { op: "crops"; jobId: string; boxes: (readonly [number, number, number, number] | null)[] }
  /** W5's "Lihat foto utuh": the whole photo, smaller, only once the teacher asks for it. */
  | { op: "photo"; jobId: string }
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
  /**
   * F1-11 cara 2: "Ketik 84 untuk Dimas." for a student (`typed: null`), or the check of what the
   * teacher typed ("Di buku 84, Bu." when it differs).
   */
  | { op: "guided-line"; entries: GradeEntry[]; studentId: string; typed: string | null }
  /** The flow's state for this tab, kept across page loads (F0-13). */
  | { op: "state-save"; state: unknown }
  | { op: "state-load" };

export type GradePhotoValue = {
  poll: InboxJob[];
  hold: null;
  release: null;
  thumbnail: string | null;
  title: PhotoTitle;
  command: GradeCommand;
  process: InboxJob;
  crops: (string | null)[];
  photo: string | null;
  finalize: GradeRulesResult;
  readback: ReadbackResult & { source: "alursekolah" | "page" };
  ack: { deleted: boolean };
  "guided-line": { sentence: string; ok: boolean | null };
  "state-save": null;
  "state-load": unknown;
};

/** Every answer: the value, or the sentence that says why there is none. */
export type GradePhotoResponse<Op extends GradePhotoRequest["op"]> =
  | { ok: true; value: GradePhotoValue[Op] }
  | { ok: false; message: string };
