import type { ExecutorTask, ExecutorVerb } from "@nemu/contracts/executor";

export type Cara = 1 | 2 | 3;

/** What happened during a run, kept for Catatan langkah (F0-14). Values are never kept. */
export type RunEvent =
  /**
   * Nemu did the step itself (cara 1). `option` is the chosen option of a select; `unchecked`
   * when a check step took a tick away.
   */
  | { kind: "acted"; verb: ExecutorVerb; name: string; option?: string; unchecked?: boolean }
  /** The teacher did it while Nemu pointed and checked (cara 2); `corrected` when Nemu had to say the right value again. */
  | { kind: "taught"; verb: ExecutorVerb; name: string; corrected?: boolean }
  /** The teacher pressed what Nemu pointed at; `refused` when Nemu had been asked to press it. */
  | { kind: "pressed"; name: string; refused: boolean }
  /** The teacher did a step Nemu couldn't find or tell apart. */
  | { kind: "skipped"; name: string }
  /** The teacher chose a point step's cancel link ("Batal, jangan hapus"); the run ended there. */
  | { kind: "cancelled"; label: string }
  /** Cara 3: the check after Simpan. */
  | { kind: "checked"; total: number; mismatched: number };

export type RunOutcome = "done" | "stopped";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function line(event: RunEvent, count: number, teacher: string, corrected: number): string {
  switch (event.kind) {
    case "acted":
      if (event.verb === "setValue") return `Nemu mengisi ${count} isian`;
      if (event.verb === "clickMenu") return `Nemu membuka ${event.name}`;
      if (event.verb === "selectOption")
        return `Nemu memilih ${event.option ?? ""} di ${event.name}`;
      if (event.verb === "check")
        return event.unchecked
          ? `Nemu menghapus centang ${event.name}`
          : `Nemu mencentang ${event.name}`;
      return `Nemu menggulir ke ${event.name}`;
    case "taught":
      if (event.verb === "setValue")
        return corrected === 0
          ? `${teacher} mengetik ${count} isian, Nemu memeriksa`
          : `${teacher} mengetik ${count} isian, Nemu memeriksa; ${corrected} sempat berbeda dan sudah dibetulkan`;
      if (event.verb === "clickMenu") return `${teacher} membuka ${event.name}`;
      if (event.verb === "selectOption") return `${teacher} memilih ${event.name}`;
      return `${teacher} mencentang ${event.name}`;
    case "pressed":
      return event.refused
        ? `Nemu tidak menekan ${event.name}; ${teacher} yang memutuskan`
        : `${teacher} menekan ${event.name}`;
    case "skipped":
      return `${teacher} mengerjakan ${event.name} sendiri`;
    case "cancelled":
      return `${teacher} memilih ${event.label}`;
    case "checked":
      return event.mismatched === 0
        ? `Nemu memeriksa ${event.total} isian: semua sesuai`
        : `Nemu memeriksa ${event.total} isian: ${event.mismatched} belum sesuai`;
  }
}

/** Two events that read as one counted line ("Nemu mengisi 32 isian"). */
function sameLine(a: RunEvent, b: RunEvent) {
  return (
    a.kind === b.kind &&
    (a.kind === "acted" || a.kind === "taught") &&
    "verb" in b &&
    a.verb === "setValue" &&
    b.verb === "setValue"
  );
}

/**
 * Catatan langkah (F0-14): a short list of what was done, by whom, with runs of filled fields
 * counted as one line. A stopped task says where it stopped and that the inputs stay.
 */
export function stepNotes(input: {
  task: ExecutorTask;
  events: readonly RunEvent[];
  outcome: RunOutcome;
  index: number;
  honorific: string;
}): string[] {
  const teacher = capitalize(input.honorific || "Anda");
  const lines: string[] = [];
  if (input.task.source) lines.push(`Sumber: ${input.task.source}`);
  input.events.forEach((event, at) => {
    const previous = input.events[at - 1];
    if (previous && sameLine(previous, event)) return;
    let count = 1;
    while (input.events[at + count] && sameLine(event, input.events[at + count] as RunEvent))
      count += 1;
    const group = input.events.slice(at, at + count);
    const corrected = group.filter((item) => item.kind === "taught" && item.corrected).length;
    lines.push(line(event, count, teacher, corrected));
  });
  // A cancel link already says where she stopped, and nothing was left half-filled.
  if (input.outcome === "stopped" && input.events.at(-1)?.kind !== "cancelled") {
    const total = input.task.steps.length;
    lines.push(
      `Berhenti di langkah ${Math.min(input.index + 1, total)} dari ${total}; isian tetap ada`,
    );
  }
  return lines;
}
