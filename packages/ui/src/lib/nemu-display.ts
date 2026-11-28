/**
 * The five display types (PRD §6.2, W15): everything Nemu shows the teacher is exactly one of
 * these at a time. The executor (#202), voice (#200) and the Nemu button build these values; the
 * components in `@nemu/ui/nemu/*` draw them.
 */

/**
 * The heading's colour, picked by the situation. The words always say it too, so colour is never
 * the only signal: `nemu` amber (GILIRAN IBU, NEMU MENGISI, JAWABAN), `muted` grey (NEMU
 * BERHENTI, MIKROFON TERBLOKIR), `danger` red (BELUM JELAS), `warning` red with the warning
 * mascot (HATI-HATI), `success` green with the success mascot (SUDAH DICEK).
 */
export type NemuTone = "nemu" | "muted" | "danger" | "warning" | "success";

/**
 * The heading on top of every display (Kepala): a small mascot, a short label in capitals, an
 * optional count on the right and an optional thin progress bar under it. Never read aloud.
 */
export type NemuStatus = {
  /**
   * Default `nemu`. The older `working` and `unsaved` draw as `nemu`, and `saved` as `success`,
   * so existing callers keep their meaning.
   */
  tone?: NemuTone | "working" | "unsaved" | "saved";
  /** "Nemu mengisi", "Giliran Ibu", "Belum jelas": drawn in capitals. */
  text: string;
  /** On the right: "1 dari 2", "10.02", "My Family". */
  count?: string;
  /** A thin progress bar under the heading; without `count`, also "13 dari 32" on the right. */
  progress?: { done: number; total: number };
};

const LEGACY_TONES = { working: "nemu", unsaved: "nemu", saved: "success" } as const;

/** The tone a heading draws in. */
export function statusTone(status: NemuStatus): NemuTone {
  const tone = status.tone ?? "nemu";
  return tone in LEGACY_TONES
    ? LEGACY_TONES[tone as keyof typeof LEGACY_TONES]
    : (tone as NemuTone);
}

/** What the heading shows on its right: the `count`, else "13 dari 32" from the progress. */
export function statusCount(status: NemuStatus): string | undefined {
  if (status.count) return status.count;
  return status.progress ? `${status.progress.done} dari ${status.progress.total}` : undefined;
}

/** A source Nemu can open, such as a cited PDF at its page (#258). */
export type NemuSourceLink = { label: string; onOpen: () => void };
export type NemuSource = string | NemuSourceLink;

export function sourceName(source: NemuSource): string {
  return typeof source === "string" ? source : source.label;
}

/** The small links under a sentence. Each is read only once the teacher clicks it. */
export type NemuNotes = {
  kenapa?: string;
  sumber?: readonly NemuSource[];
  /** A link under the Sumber list, such as "Lihat diagram" for a BPMN-backed answer. */
  sumberLink?: { label: string; href: string };
  ringkasan?: string;
};
export type NemuNoteKind = "kenapa" | "sumber" | "ringkasan";

/** Gelembung Tunjuk carries at most one link. */
export type NemuSingleNote =
  | { kenapa: string; sumber?: never; ringkasan?: never }
  | { sumber: readonly NemuSource[]; kenapa?: never; ringkasan?: never }
  | { ringkasan: string; kenapa?: never; sumber?: never };

/**
 * What every bubble shares: one sentence, an optional quieter detail line, the word being spoken
 * (#200), and its links' reader.
 */
type BubbleBase = {
  sentence: string;
  /** A quieter line under the sentence: "Klik atau ketik kalau Ibu mau isi sendiri." Not read aloud. */
  detail?: string;
  /** Index of the word Nemu's voice is on, counting words split on spaces. */
  highlightedWord?: number;
  status?: NemuStatus;
  /** Called with a link's text when the teacher opens it, so Nemu can read it then. */
  onRead?: (text: string) => void;
};

/** Gelembung Kerja: Nemu is working. [Pelan] when it can slow down, and always [Berhenti]. */
export type GelembungKerjaProps = BubbleBase & {
  status: NemuStatus;
  slow?: boolean;
  /** Without it there is no Pelan, such as while Nemu reads a photo. */
  onSlow?: () => void;
  onStop: () => void;
};

/** Gelembung Tunjuk: the teacher's turn. Points at a field or button; no buttons. */
export type GelembungTunjukProps = BubbleBase & {
  note?: NemuSingleNote;
  /** A small amber chip under the text, such as "Belum tersimpan". */
  chip?: string;
  /** A way out as a link at the bottom, such as "Batal, jangan hapus". */
  cancel?: { label: string; onSelect: () => void };
};

/** Gelembung Jawab: an answer or a problem, with at most one (black) action button. */
export type GelembungJawabProps = BubbleBase & {
  notes?: NemuNotes;
  action?: { label: string; onSelect: () => void };
  onClose?: () => void;
  /** Clicking the sentence asks Nemu's voice to say it again (#200). */
  onRepeat?: () => void;
};

export type NemuChoice = {
  id: string;
  label: string;
  risky?: boolean;
  /** On a `compact` card, the main choice: the black button ("Mulai"). The rest are outline. */
  primary?: boolean;
};

/** Kartu Pilih: one question, two or three equal choices, nothing pre-selected. */
export type KartuPilihProps = {
  question: string;
  /** A quieter line between the question and the choices: "Pilih salah satu, Nemu menunggu." */
  detail?: string;
  choices: readonly [NemuChoice, NemuChoice] | readonly [NemuChoice, NemuChoice, NemuChoice];
  onChoose: (id: string) => void;
  /**
   * What the question is about, in a framed box under the question: the enlarged cell of the
   * grade-book photo (W5), or on a `compact` card the photo's thumbnail (#278). `caption` names it
   * at the top of the box ("Foto dari WhatsApp · 1 halaman"). On a `compact` card, no `src` yet
   * shows a Skeleton of its shape.
   */
  image?: { src?: string; alt: string; caption?: string };
  /** One quiet line under the choices: "Pertanyaan 1 dari 10 · 22 nilai lain sudah cocok." */
  note?: string;
  /**
   * The card that waits beside the Nemu button, such as "Foto masuk": its choices are compact
   * buttons on the right, in the order given, the `primary` one black.
   */
  compact?: boolean;
  /** The heading: "NEMU BERHENTI · 3 dari 32", "HATI-HATI · My Family". */
  status?: NemuStatus;
};

/** Kartu Info: something to read, a title, a short list and one [Tutup]. */
export type KartuInfoProps = {
  /** The heading: "MIKROFON TERBLOKIR", "HASIL PEMERIKSAAN", "SUDAH DICEK". */
  status?: NemuStatus;
  title: string;
  /** A quieter line under the title: "Yang lain sudah benar: 15 soal, kelas 4A." Not read aloud. */
  detail?: string;
  /** Numbered 1, 2, 3 in small amber circles. */
  items: readonly string[];
  /** A small label above the list, such as "Catatan langkah · Cara pasang kuis". */
  itemsLabel?: string;
  /** At most one small link left of Tutup, such as Catatan langkah's "Coba sendiri". */
  link?: { label: string; onSelect: () => void };
  onClose: () => void;
};

export type NemuDisplay =
  | ({ type: "kerja" } & GelembungKerjaProps)
  | ({ type: "tunjuk" } & GelembungTunjukProps)
  | ({ type: "jawab" } & GelembungJawabProps)
  | ({ type: "pilih" } & KartuPilihProps)
  | ({ type: "info" } & KartuInfoProps);

/**
 * What Nemu says when a display appears: the sentence, question or title only, never the detail
 * line, the header, the links or the buttons.
 */
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
  if (kind === "sumber") return `Sumber: ${(notes.sumber ?? []).map(sourceName).join("; ")}`;
  return notes[kind] ?? "";
}

/** The whole heading as one line, for screen readers: "Nemu mengisi · 13 dari 32". */
export function statusText(status: NemuStatus): string {
  const count = statusCount(status);
  return count ? `${status.text} · ${count}` : status.text;
}

/** Safe choices first, risky ones (⚠) under them; otherwise the order given. */
export function orderChoices<T extends NemuChoice>(choices: readonly T[]): T[] {
  return [
    ...choices.filter((choice) => !choice.risky),
    ...choices.filter((choice) => choice.risky),
  ];
}
