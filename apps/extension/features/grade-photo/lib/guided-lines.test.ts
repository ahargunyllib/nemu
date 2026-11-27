// @vitest-environment happy-dom
import { guidedCheck, guidedPrompt } from "@nemu/ai/school/grades/guided";
import type { GradeEntry } from "@nemu/contracts/school";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { createRunState, ExecutorRun, type RunDeps } from "../../executor/lib/run";
import type { Cara } from "../../executor/lib/run-notes";
import scenarioCsv from "./F1-2_cara-2_skenario.csv?raw";
import { gradeTask } from "./grade-task";
import { gradeGuide, type GuidedLineSource } from "./guided-lines";

/** F1-2's scenario: the book, and what the teacher types first in cara 2 (two deliberately off). */
type ScenarioRow = { name: string; book: string; note: string; firstTyped: string };
const SCENARIO: ScenarioRow[] = scenarioCsv
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [, name, book, note, firstTyped] = line.split(",");
    return { name: name!, book: book!, note: note!, firstTyped: firstTyped! };
  });

const ENTRIES: GradeEntry[] = SCENARIO.map((row, at) => ({
  studentId: `s-${at + 1}`,
  name: row.name,
  value: row.book === "" ? null : Number(row.book),
  status: row.book === "" ? "S" : "value",
  remedial: row.note === "remedial",
}));

/** `gradesGuidedLine` as the Nemu Service answers it for Bu Siti (honorific "Bu"). */
const serviceLine: GuidedLineSource = async (entries, studentId, typed) => {
  const entry = entries.find((item) => item.studentId === studentId);
  if (!entry) return null;
  if (typed === null) return { sentence: guidedPrompt(entry, entries), ok: null };
  return guidedCheck(entry, typed, "Bu");
};

/** Isi nilai kelas for 4B after Tampilkan Siswa: one row per student, Nilai and Catatan, Simpan. */
function gradeTable() {
  document.body.innerHTML = `
    <table>
      <thead><tr><th>No</th><th>Nama</th><th>Nilai</th><th>Catatan</th></tr></thead>
      <tbody>${SCENARIO.map(
        (row, at) => `<tr><td>${at + 1}</td><td>${row.name}</td>
          <td><input type="number" aria-label="Nilai ${row.name}"></td>
          <td><input type="text" aria-label="Catatan ${row.name}"></td></tr>`,
      ).join("")}</tbody>
    </table>
    <button>Simpan</button>`;
}

const field = (column: string, name: string) =>
  document.querySelector(`[aria-label='${column} ${name}']`) as HTMLInputElement;

/** The fill and Simpan of F1's task; the menu steps need the whole mock page. */
const TASK = gradeTask({
  command: { className: "4B", subject: "Matematika", assessment: "UTS" },
  entries: ENTRIES,
  summarySentence: "32 nilai.",
  honorific: "Bu",
});
const FILL = { ...TASK, steps: TASK.steps.slice(5) };

/**
 * Bu Siti in cara 2: she types what Nemu says into the field it points at and leaves it, except
 * that the first time on each row she types what F1-2's scenario says (two rows deliberately off).
 */
function teacher() {
  const tries = new Map<string, number>();
  return (display: NemuDisplay | null, target: Element | null) => {
    if (display?.type !== "tunjuk" || !(target instanceof HTMLInputElement)) return;
    const [column, ...name] = (target.getAttribute("aria-label") ?? "").split(" ");
    const row = SCENARIO.find((item) => item.name === name.join(" "));
    if (!row) return;
    const count = tries.get(target.getAttribute("aria-label")!) ?? 0;
    tries.set(target.getAttribute("aria-label")!, count + 1);
    const value = column === "Catatan" ? row.note : count === 0 ? row.firstTyped : row.book;
    setTimeout(() => {
      target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }, 0);
  };
}

function harness(cara: Cara, sleep?: RunDeps["sleep"]) {
  const spoken: string[] = [];
  const shown: (NemuDisplay | null)[] = [];
  const ended = vi.fn<RunDeps["onEnd"]>();
  const act = teacher();
  let typing = false;
  const run = new ExecutorRun(createRunState(FILL, { cara }), {
    doc: document,
    honorific: "Bu",
    fieldMs: 1,
    render: ({ display, target }) => {
      shown.push(display);
      if (typing) act(display, target);
    },
    speak: (text) => spoken.push(text),
    sleep: sleep ?? (() => new Promise((resolve) => setTimeout(resolve, 0))),
    log: () => undefined,
    save: () => undefined,
    guide: gradeGuide({ entries: async () => ENTRIES, line: serviceLine }),
    onEnd: ended,
    isTrusted: () => true,
  });
  return {
    run,
    spoken,
    ended,
    display: () => shown.at(-1) ?? null,
    teacherTypes: () => (typing = true),
  };
}

/** F1-2's pass mark: every Nilai and Catatan on the page is the book's when Simpan is pointed at. */
function wrongOnPage(): string[] {
  return SCENARIO.flatMap((row) => [
    ...(field("Nilai", row.name).value === row.book ? [] : [`Nilai ${row.name}`]),
    ...(field("Catatan", row.name).value === row.note ? [] : [`Catatan ${row.name}`]),
  ]);
}

const SAVE = { type: "tunjuk", sentence: "Silakan Ibu tekan Simpan." };

beforeEach(gradeTable);

describe("F1 cara 2 (F1-2)", () => {
  test("the scenario has two deliberate mismatches", () => {
    const off = SCENARIO.filter((row) => row.firstTyped !== row.book);
    expect(off.map((row) => row.name)).toEqual(["Bagas Saputra", "Budi Santoso"]);
  });

  test("Nemu says each grade from the book, catches both mismatches gently, and 0 wrong grades are left", async () => {
    const { run, spoken, display, teacherTypes } = harness(2);
    teacherTypes();
    void run.run();
    await vi.waitFor(() => expect(display()).toMatchObject(SAVE), { timeout: 5000 });

    expect(spoken).toContain("Ketik 62 untuk Ahmad.");
    expect(spoken).toContain("Ketik 68 untuk Bagas.");
    expect(spoken).toContain("Di Catatan Ahmad Fadli, tulis remedial.");
    expect(spoken).toContain(
      "Untuk Raka dikosongkan saja. Di Catatan Raka Aditya, tulis tidak hadir.",
    );
    // Both deliberate mismatches are caught, each with the book's value, and nothing else is.
    const corrections = spoken.filter((line) => line.startsWith("Di buku"));
    expect(corrections).toEqual(["Di buku 68, Bu.", "Di buku 77, Bu."]);
    expect(spoken.some((line) => /salah/iu.test(line))).toBe(false);
    expect(wrongOnPage()).toEqual([]);
  });

  test("'Ajari saya' in the middle of the cara 1 fill switches the remaining rows to cara 2", async () => {
    // Nemu waits once Alya is filled, so "Ajari saya" lands before Bagas, the first row off.
    const { run, spoken, display, teacherTypes, ended } = harness(1, (_ms, signal) =>
      field("Nilai", "Alya Nur Fitri").value === "90" && run.state.cara === 1
        ? new Promise((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          )
        : new Promise((resolve) => setTimeout(resolve, 0)),
    );
    void run.run();
    await vi.waitFor(() => expect(field("Nilai", "Alya Nur Fitri").value).toBe("90"));
    teacherTypes();
    run.teach();
    await vi.waitFor(() => expect(display()).toMatchObject(SAVE), { timeout: 5000 });

    expect(run.state.cara).toBe(2);
    expect(spoken).not.toContain("Ketik 62 untuk Ahmad.");
    expect(spoken.filter((line) => line.startsWith("Di buku"))).toEqual([
      "Di buku 68, Bu.",
      "Di buku 77, Bu.",
    ]);
    expect(wrongOnPage()).toEqual([]);

    (document.querySelector("button") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(ended).toHaveBeenCalled());
    expect(ended.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Nemu mengisi \d+ isian$/u),
        expect.stringMatching(
          /^Bu mengetik \d+ isian, Nemu memeriksa; 2 sempat berbeda dan sudah dibetulkan$/u,
        ),
      ]),
    );
  });

  test("the teacher taking over (Saya isi sendiri) switches the remaining rows to cara 2", async () => {
    // Nemu waits once Ahmad is filled, so she takes over before Bagas, the first row off.
    let hold = true;
    const { run, spoken, display, teacherTypes } = harness(1, (_ms, signal) =>
      hold && field("Nilai", "Ahmad Fadli").value === "62"
        ? new Promise((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          )
        : new Promise((resolve) => setTimeout(resolve, 0)),
    );
    void run.run();
    await vi.waitFor(() => expect(field("Nilai", "Ahmad Fadli").value).toBe("62"));
    await vi.waitFor(() => expect(run.isActing()).toBe(true));
    // Her own mouse on the page stops Nemu (F0-07), which asks how to go on.
    run.interrupt();
    const card = display();
    if (card?.type !== "pilih") throw new Error("expected Kartu Pilih");
    hold = false;
    teacherTypes();
    card.onChoose("sendiri");
    await vi.waitFor(() => expect(display()).toMatchObject(SAVE), { timeout: 5000 });

    expect(run.state.cara).toBe(2);
    expect(spoken.filter((line) => line.startsWith("Di buku"))).toEqual([
      "Di buku 68, Bu.",
      "Di buku 77, Bu.",
    ]);
    expect(wrongOnPage()).toEqual([]);
  });

  test("without the Nemu Service Nemu falls back to its own words and check", async () => {
    const offline = gradeGuide({ entries: async () => ENTRIES, line: async () => null });
    const step = FILL.steps[0];
    if (step?.verb !== "setValue") throw new Error("expected a value step");
    expect(await offline.prompt(step)).toBeNull();
    expect(await offline.check(step, "28")).toBeNull();
  });
});
