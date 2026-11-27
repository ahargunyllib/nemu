/**
 * The five display types (PRD §6.2, W15): everything Nemu shows the teacher is exactly one of
 * these at a time. The executor (#202), voice (#200) and the Nemu button build these values; the
 * components in `@nemu/ui/nemu/*` draw them.
 */

/** The bubble header: what Nemu is doing or whether the page is saved. Never read aloud. */
export type NemuStatus = {
  /** Picks the icon; the text always says the same thing, so colour is never the only signal. */
  tone: "working" | "unsaved" | "saved";
  /** "Nemu mengisi", "Belum tersimpan", "Tersimpan". */
  text: string;
  /** Adds "· 13 dari 32" to the text and a progress bar under it. */
  progress?: { done: number; total: number };
};

/** The small links under a sentence. Each is read only once the teacher clicks it. */
export type NemuNotes = {
  kenapa?: string;
  sumber?: readonly string[];
  /** A link under the Sumber list, such as "Lihat diagram" for a BPMN-backed answer. */
  sumberLink?: { label: string; href: string };
  ringkasan?: string;
};
export type NemuNoteKind = "kenapa" | "sumber" | "ringkasan";

/** Gelembung Tunjuk carries at most one link. */
export type NemuSingleNote =
  | { kenapa: string; sumber?: never; ringkasan?: never }
  | { sumber: readonly string[]; kenapa?: never; ringkasan?: never }
  | { ringkasan: string; kenapa?: never; sumber?: never };

/** What every bubble shares: one sentence, the word being spoken (#200), and its links' reader. */
type BubbleBase = {
  sentence: string;
  /** Index of the word Nemu's voice is on, counting words split on spaces. */
  highlightedWord?: number;
  status?: NemuStatus;
  /** Called with a link's text when the teacher opens it, so Nemu can read it then. */
  onRead?: (text: string) => void;
};

/** Gelembung Kerja: Nemu is working. Always [Pelan] [Berhenti]. */
export type GelembungKerjaProps = BubbleBase & {
  status: NemuStatus;
  slow?: boolean;
  onSlow: () => void;
  onStop: () => void;
};

/** Gelembung Tunjuk: the teacher's turn. Points at a field or button; no buttons. */
export type GelembungTunjukProps = BubbleBase & { note?: NemuSingleNote };

/** Gelembung Jawab: an answer or a problem, with at most one action button. */
export type GelembungJawabProps = BubbleBase & {
  notes?: NemuNotes;
  action?: { label: string; onSelect: () => void };
  onClose?: () => void;
  /** Clicking the sentence asks Nemu's voice to say it again (#200). */
  onRepeat?: () => void;
};

export type NemuChoice = { id: string; label: string; risky?: boolean };

/** Kartu Pilih: one question, two or three equal choices, nothing pre-selected. */
export type KartuPilihProps = {
  question: string;
  choices: readonly [NemuChoice, NemuChoice] | readonly [NemuChoice, NemuChoice, NemuChoice];
  onChoose: (id: string) => void;
  /** What the question is about, enlarged: the cell of the grade-book photo (W5). */
  image?: { src: string; alt: string };
  /** One quiet line under the choices: "Pertanyaan 1 dari 10 · 22 nilai lain sudah cocok." */
  note?: string;
  /** A small card that waits beside the Nemu button, such as "Foto dari WhatsApp". */
  compact?: boolean;
};

/** Kartu Info: something to read, a title, a short list and one [Tutup]. */
export type KartuInfoProps = {
  title: string;
  items: readonly string[];
  /** At most one small link above Tutup, such as Catatan langkah's "Lain kali coba sendiri". */
  link?: { label: string; onSelect: () => void };
  onClose: () => void;
};

export type NemuDisplay =
  | ({ type: "kerja" } & GelembungKerjaProps)
  | ({ type: "tunjuk" } & GelembungTunjukProps)
  | ({ type: "jawab" } & GelembungJawabProps)
  | ({ type: "pilih" } & KartuPilihProps)
  | ({ type: "info" } & KartuInfoProps);

/** What Nemu says when a display appears: never the header, the links or the buttons. */
export function spokenText(display: NemuDisplay): string {
  switch (display.type) {
    case "pilih":
      return display.question;
    case "info":
      return display.title;
    default:
      return display.sentence;
  }
}

export const NOTE_LABELS: Record<NemuNoteKind, string> = {
  kenapa: "Kenapa?",
  sumber: "Sumber",
  ringkasan: "Lihat ringkasan",
};

/** The text a link reads out once it is opened. */
export function noteText(kind: NemuNoteKind, notes: NemuNotes): string {
  if (kind === "sumber") return `Sumber: ${(notes.sumber ?? []).join("; ")}`;
  return notes[kind] ?? "";
}

/** "Nemu mengisi · 13 dari 32" */
export function statusText(status: NemuStatus): string {
  return status.progress
    ? `${status.text} · ${status.progress.done} dari ${status.progress.total}`
    : status.text;
}

/** Safe choices first, risky ones (⚠) under them; otherwise the order given. */
export function orderChoices<T extends NemuChoice>(choices: readonly T[]): T[] {
  return [
    ...choices.filter((choice) => !choice.risky),
    ...choices.filter((choice) => choice.risky),
  ];
}
