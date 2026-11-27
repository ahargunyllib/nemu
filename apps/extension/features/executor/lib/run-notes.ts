import type { ExecutorTask, ExecutorVerb } from "@nemu/contracts/executor";

export type Cara = 1 | 2 | 3;

/** What happened during a run, kept for Catatan langkah (F0-14). Values are never kept. */
export type RunEvent =
  /** Nemu did the step itself (cara 1). `option` is the chosen option of a select. */
  | { kind: "acted"; verb: ExecutorVerb; name: string; option?: string }
  /** The teacher did it while Nemu pointed and checked (cara 2). */
  | { kind: "taught"; verb: ExecutorVerb; name: string }
  /** The teacher pressed what Nemu pointed at; `refused` when Nemu had been asked to press it. */
  | { kind: "pressed"; name: string; refused: boolean }
  /** The teacher did a step Nemu couldn't find or tell apart. */
  | { kind: "skipped"; name: string }
  /** Cara 3: the check after Simpan. */
  | { kind: "checked"; total: number; mismatched: number };

export type RunOutcome = "done" | "stopped";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function line(event: RunEvent, count: number, teacher: string): string {
  switch (event.kind) {
    case "acted":
      if (event.verb === "setValue") return `Nemu mengisi ${count} isian`;
      if (event.verb === "clickMenu") return `Nemu membuka ${event.name}`;
      if (event.verb === "selectOption")
        return `Nemu memilih ${event.option ?? ""} di ${event.name}`;
      if (event.verb === "check") return `Nemu mencentang ${event.name}`;
      return `Nemu menggulir ke ${event.name}`;
    case "taught":
      if (event.verb === "setValue") return `${teacher} mengetik ${count} isian, Nemu memeriksa`;
      if (event.verb === "clickMenu") return `${teacher} membuka ${event.name}`;
      if (event.verb === "selectOption") return `${teacher} memilih ${event.name}`;
      return `${teacher} mencentang ${event.name}`;
    case "pressed":
      return event.refused
        ? `Nemu tidak menekan ${event.name}; ${teacher} yang memutuskan`
        : `${teacher} menekan ${event.name}`;
    case "skipped":
      return `${teacher} mengerjakan ${event.name} sendiri`;
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
    lines.push(line(event, count, teacher));
  });
  if (input.outcome === "stopped") {
    const total = input.task.steps.length;
    lines.push(
      `Berhenti di langkah ${Math.min(input.index + 1, total)} dari ${total}; isian tetap ada`,
    );
  }
  return lines;
}
