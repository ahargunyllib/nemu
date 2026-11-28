// @vitest-environment happy-dom
import type { ExecutorTask } from "@nemu/contracts/executor";
import { describe, expect, test, vi } from "vite-plus/test";

import type { RunEvent } from "../../executor/lib/run-notes";
import { createRunState, type RunState } from "../../executor/lib/run";

const finishers = new Map<string, (ended: RunState, notes: string[], show: boolean) => void>();
const executor = {
  registerStepSource: vi.fn(),
  registerFinisher: (
    kind: string,
    finisher: (ended: RunState, notes: string[], show: boolean) => void,
  ) => finishers.set(kind, finisher),
  start: vi.fn(async () => {}),
  presentNotes: vi.fn(),
};
vi.mock("../../executor/stores/executor", () => ({ executor }));

await import("./quiz-delete");
const { SHOW_DELETE_KIND } = await import("../lib/delete-task");

const SOURCE = "Halaman Hasil: 3 siswa sudah mengerjakan Latihan: My Family (has/have)";
const TASK: ExecutorTask = {
  kind: SHOW_DELETE_KIND,
  title: "Tunjukkan tombol Hapus",
  source: SOURCE,
  steps: [],
};

function finish(status: "done" | "stopped", last: RunEvent) {
  executor.presentNotes.mockClear();
  const ended = { ...createRunState(TASK, { cara: 1 }), status, events: [last] };
  finishers.get(SHOW_DELETE_KIND)!(ended, [`Sumber: ${SOURCE}`], true);
  return executor.presentNotes.mock.calls[0]![0] as string[];
}

describe("the end of Tunjukkan tombol Hapus (F4-06)", () => {
  test("Batal, jangan hapus ends it as Jangan hapus does: the quiz and its grades stay", () => {
    const lines = finish("stopped", { kind: "cancelled", label: "Batal, jangan hapus" });
    expect(lines.slice(-2)).toEqual([
      "Pilihan: Jangan hapus. Kuis dan nilainya tetap ada.",
      "Nemu tidak menekan Hapus; Nemu hanya menunjuknya.",
    ]);
  });

  test("when she presses Hapus herself, the notes don't say the quiz stays", () => {
    const lines = finish("done", { kind: "pressed", name: "Hapus", refused: false });
    expect(lines.at(-1)).toBe("Nemu tidak menekan Hapus; Nemu hanya menunjuknya.");
    expect(lines.join("\n")).not.toContain("tetap ada");
  });
});
