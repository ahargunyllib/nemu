import type {
  ActionLogEntry,
  ExecutorStep,
  ExecutorTask,
  ExecutorVerb,
} from "@nemu/contracts/executor";
import type { SitePermission } from "@nemu/contracts/extension";
import type { NemuDisplay, NemuStatus } from "@nemu/ui/lib/nemu-display";

import { addressFor } from "./address";
import { describeTarget, findTarget, type TargetLookup } from "./find-target";
import {
  bringIntoView,
  chooseOption,
  currentValue,
  isChecked,
  isValueField,
  sameValue,
  setChecked,
  typeValue,
} from "./page-actions";
import { type Cara, type RunEvent, type RunOutcome, stepNotes } from "./run-notes";
import { refusalFor, sitePermits } from "./safety";

/** How long the Nemu cursor glides to the next target (`GLIDE_MS` in `@nemu/ui/nemu/nemu-stage`). */
export const CURSOR_GLIDE_MS = 600;
/**
 * How long "Membuka …" stays up before Nemu clicks the menu (F0-13). The stage shows a display
 * only once the cursor has arrived, so without this the click and the line came together and the
 * next page replaced the line before the teacher could read it (#257).
 */
const NAVIGATE_READ_MS = 800;
/** One digit typed (cara 1); Pelan doubles every wait. */
const CHAR_MS = 120;
/** How long a target may take to appear, e.g. after a menu opens another page. */
const LOCATE_MS = 5000;
const LOCATE_POLL_MS = 200;
/** A page drawn after a menu click. */
const SETTLE_MS = 400;
/** F0-09: two retries after the first failure, then stop at a safe step. */
const MAX_RETRIES = 2;
const RETRY_MS = 1500;
/** Roughly how long Nemu takes to say a word (the local voice speaks at 0.85×). */
const WORD_MS = 380;

/** Where the run is. Everything but `done` and `stopped` can go on with `resume`. */
export type RunStatus = "running" | "paused" | "asking" | "offline" | "done" | "stopped";

/** A run as kept in `chrome.storage.session`, so it survives page loads (F0-13). */
export type RunState = {
  id: string;
  task: ExecutorTask;
  cara: Cara;
  /** The cara the run started in, for "Coba sendiri". */
  startCara: Cara;
  slow: boolean;
  /** The next step to do. */
  index: number;
  /** Steps the extension refused when it checked the task; they only point (F0-08). */
  refused: number[];
  /** Steps Nemu filled, ticked on the page. */
  ticked: number[];
  events: RunEvent[];
  status: RunStatus;
  /** What the task's step source needs for the next steps, or null when there are none. */
  continuation: unknown;
};

/** More steps for a task whose steps come in parts (a BPMN walk, the AI). It may fail (F0-09). */
export type StepSource = (
  continuation: unknown,
) => Promise<{ steps: ExecutorStep[]; continuation: unknown }>;

/** Lihat ringkasan as its own Kartu Info (F1·11a). */
type RingkasanCard = NonNullable<Extract<ExecutorStep, { verb: "point" }>["ringkasanCard"]>;

/** A value step in cara 2. */
export type GuidedStep = Extract<ExecutorStep, { verb: "setValue" }>;

/**
 * A feature's own words for cara 2 value steps, e.g. F1's grade lines (F1-11): what Nemu says as
 * it points, and the check of what the teacher typed once she leaves the field. `null` (or a
 * failure) falls back to the executor's own words and check.
 */
export type CaraTwoGuide = {
  prompt(step: GuidedStep): Promise<GuideLine | null>;
  check(step: GuidedStep, typed: string): Promise<(GuideLine & { ok: boolean }) | null>;
};

/** What Nemu says (`sentence`) and the quieter line under it (`detail`, not spoken). */
export type GuideLine = { sentence: string; detail?: string };

export type RunView = { display: NemuDisplay | null; target: Element | null; ticks: Element[] };

export type RunDeps = {
  doc: Document;
  /** "Bu" or "Pak", as WS-06 knows the teacher; "" when unknown. */
  honorific: string;
  /** One field per this many ms in cara 1 (WS-08 fill speed); Pelan doubles it. */
  fieldMs: number;
  /** What the site lets Nemu do (WS-03); a step it doesn't permit is the teacher's. Default read_fill. */
  permission?: SitePermission;
  render(view: RunView): void;
  speak(text: string): void;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  log(entry: Pick<ActionLogEntry, "action" | "target" | "result">): void;
  save(state: RunState): void;
  source?: StepSource;
  /** The task's own cara 2 words for value steps; with one, a value is checked when she leaves the field. */
  guide?: CaraTwoGuide;
  /** The run ended: show Catatan langkah when `showNotes`. */
  onEnd(state: RunState, notes: string[], showNotes: boolean): void;
  /** Whether an event came from the teacher's hand. Tests stand in for `isTrusted`. */
  isTrusted?: (event: Event) => boolean;
};

/** The run moved on without this step: someone stopped, paused or redirected it. */
class Interrupted extends Error {}

export function createRunState(
  task: ExecutorTask,
  options: { cara: Cara; refused?: number[]; continuation?: unknown },
): RunState {
  return {
    id: crypto.randomUUID(),
    task,
    cara: options.cara,
    startCara: options.cara,
    slow: false,
    index: 0,
    refused: options.refused ?? [],
    ticked: [],
    events: [],
    status: "running",
    continuation: options.continuation ?? null,
  };
}

function waitForEvent(
  target: EventTarget,
  types: readonly string[],
  accept: (event: Event) => boolean,
  signal: AbortSignal,
): Promise<Event> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      for (const type of types) target.removeEventListener(type, listener, true);
      signal.removeEventListener("abort", abort);
    };
    const listener = (event: Event) => {
      if (!accept(event)) return;
      cleanup();
      resolve(event);
    };
    const abort = () => {
      cleanup();
      reject(new Interrupted());
    };
    if (signal.aborted) return abort();
    for (const type of types) target.addEventListener(type, listener, true);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function wordCount(sentence: string): number {
  return sentence.split(/\s+/u).length;
}

/** Cara 1 reads this many student rows aloud, one by one, before going faster (F1·07a–07c). */
const READ_ROWS = 3;

/** The student row a value step fills: its `rowName`, or the row its target is found by. */
function rowOf(step: ExecutorStep | undefined): string | undefined {
  if (step?.verb !== "setValue") return undefined;
  return step.rowName ?? step.target.row;
}

const VALUE_VERBS: ReadonlySet<ExecutorVerb> = new Set(["setValue", "selectOption", "check"]);

/**
 * One task on one page (PRD §6.1). Cara 1: Nemu fills at about a field per second, typing digits
 * one by one, ticking rows and saying the first three students, and stops before Simpan. Cara 2: Nemu
 * points, says the value and checks what the teacher typed. Cara 3: the teacher works alone and
 * Nemu checks once she presses Simpan. The teacher's own input stops cara 1 (F0-07); forbidden
 * targets are pointed at, never pressed (F0-08).
 */
export class ExecutorRun {
  state: RunState;
  private readonly deps: RunDeps;
  private controller = new AbortController();
  private readonly tickElements = new Map<number, Element>();
  private view: RunView = { display: null, target: null, ticks: [] };
  /** Nemu is pointing and waiting for the teacher; `refused` when it was asked to press it. */
  waiting: { refused: boolean } | null = null;
  /** "Sisanya saya isi lebih cepat" is said once; it stays up for the rows after it. */
  private saidFaster = false;

  constructor(state: RunState, deps: RunDeps) {
    this.state = state;
    this.deps = deps;
  }

  /** Nemu is changing the page right now, so the teacher's input interrupts it (F0-07). */
  isActing(): boolean {
    return this.state.status === "running" && this.state.cara === 1 && this.waiting === null;
  }

  isActive(): boolean {
    return this.state.status !== "done" && this.state.status !== "stopped";
  }

  // --- Commands -------------------------------------------------------------------------------

  /** Starts, or goes on from the current step after a pause, a question or a lost connection. */
  async run(): Promise<void> {
    const signal = this.restart();
    this.state.status = "running";
    this.save();
    try {
      if (this.state.cara === 3) await this.checkAfterSave(signal);
      else await this.walk(signal);
      if (!signal.aborted) this.end("done");
    } catch (error) {
      if (signal.aborted || error instanceof Interrupted) return;
      console.warn("[nemu] the executor stopped on an unexpected error", error);
      this.end("stopped");
    } finally {
      if (this.controller.signal === signal) this.waiting = null;
    }
  }

  resume() {
    if (
      this.state.status === "paused" ||
      this.state.status === "asking" ||
      this.state.status === "offline"
    )
      void this.run();
  }

  /** Voice: the teacher holds the talk combination (F0-15). */
  pause() {
    if (this.state.status !== "running") return;
    this.halt("paused");
    this.render({
      type: "kerja",
      sentence: "Nemu mendengarkan.",
      status: { tone: "working", text: "Berhenti sebentar" },
      slow: this.state.slow,
      onSlow: () => this.setSlow(!this.state.slow),
      onStop: () => this.askToStop(),
    });
  }

  /** Pelan halves the speed; it applies from the next character or field. */
  setSlow(slow: boolean) {
    this.state.slow = slow;
    this.save();
    const display = this.view.display;
    if (display?.type === "kerja") this.render({ ...display, slow }, this.view.target);
  }

  /** "Ajari saya" (F0-11): cara 2 from the current step, at any time. */
  teach() {
    if (!this.isActive()) return;
    this.state.cara = 2;
    if (this.state.status === "running") void this.run();
    else this.resume();
  }

  /** Berhenti: the task ends where it is, inputs kept; Catatan langkah unless `showNotes` is false. */
  stop(showNotes = true) {
    if (this.isActive()) this.end("stopped", showNotes);
  }

  /**
   * Berhenti in the Gelembung Kerja (F0-11): Nemu stops acting and asks whether she fills the rest
   * herself (cara 2 from the current step) or ends the task. Nothing is saved or pressed either way.
   * The voice command "berhenti" is a short command (F0-15) and ends at once with `stop`.
   */
  askToStop() {
    if (!this.isActive()) return;
    if (this.state.cara !== 1) return this.stop();
    this.halt("asking");
    const teacher = this.deps.honorific || "Anda";
    this.render({
      type: "pilih",
      question: `Nemu berhenti. ${teacher} mau isi sendiri?`,
      choices: [
        { id: "sendiri", label: "Ya, saya isi sendiri" },
        { id: "berhenti", label: "Tidak, berhenti" },
      ],
      onChoose: (id) => (id === "sendiri" ? this.teach() : this.stop()),
    });
  }

  /** F0-07: the teacher's own mouse or key stops Nemu and asks how to go on. */
  interrupt() {
    if (!this.isActing()) return;
    this.halt("asking");
    this.askHowToGoOn();
  }

  /** Kartu Pilih: Saya isi sendiri (cara 2) / Nemu lanjut / Berhenti. */
  private askHowToGoOn() {
    const teacher = this.deps.honorific || "Anda";
    this.render({
      type: "pilih",
      question: `Nemu berhenti karena ${teacher} memakai halaman. Lanjut bagaimana?`,
      choices: [
        { id: "sendiri", label: "Saya isi sendiri" },
        { id: "lanjut", label: "Nemu lanjut" },
        { id: "berhenti", label: "Berhenti" },
      ],
      onChoose: (id) => {
        if (id === "sendiri") this.teach();
        else if (id === "lanjut") this.resume();
        else this.stop();
      },
    });
  }

  /** After a page load: carry on, or ask again if Nemu had stopped to ask. */
  restore() {
    for (const index of this.state.ticked) {
      const step = this.state.task.steps[index];
      const lookup = step ? findTarget(this.deps.doc, step.target) : null;
      if (lookup?.status === "found") this.tickElements.set(index, lookup.element);
    }
    if (this.state.status === "running") void this.run();
    else if (this.isActive()) {
      this.state.status = "asking";
      this.askHowToGoOn();
    }
  }

  // --- The walk -------------------------------------------------------------------------------

  private restart(): AbortSignal {
    this.controller.abort();
    this.controller = new AbortController();
    this.waiting = null;
    return this.controller.signal;
  }

  private halt(status: RunStatus) {
    this.controller.abort();
    this.waiting = null;
    this.state.status = status;
    this.save();
  }

  private save() {
    this.deps.save(this.state);
  }

  private render(display: NemuDisplay | null, target: Element | null = null) {
    this.view = { display, target, ticks: [...this.tickElements.values()] };
    this.deps.render(this.view);
  }

  private trusted(event: Event): boolean {
    return (this.deps.isTrusted ?? ((candidate: Event) => candidate.isTrusted))(event);
  }

  private async sleep(ms: number, signal: AbortSignal) {
    await this.deps.sleep(ms, signal);
    if (signal.aborted) throw new Interrupted();
  }

  private async walk(signal: AbortSignal) {
    for (;;) {
      if (this.state.index >= this.state.task.steps.length) {
        if (!(await this.loadMore(signal))) return;
        continue;
      }
      const index = this.state.index;
      await this.step(index, signal);
      if (signal.aborted) return;
      this.state.index = index + 1;
      this.save();
    }
  }

  /** F0-09: more steps from the source, with two retries and a plain message, then a safe stop. */
  private async loadMore(signal: AbortSignal): Promise<boolean> {
    const { continuation } = this.state;
    if (continuation === null || continuation === undefined || !this.deps.source) return false;
    for (let attempt = 0; ; attempt += 1) {
      try {
        const more = await this.deps.source(continuation);
        if (signal.aborted) throw new Interrupted();
        this.state.task = { ...this.state.task, steps: [...this.state.task.steps, ...more.steps] };
        this.state.continuation = more.continuation ?? null;
        this.save();
        return more.steps.length > 0 || this.state.continuation !== null;
      } catch (error) {
        if (error instanceof Interrupted || signal.aborted) throw new Interrupted();
        if (attempt >= MAX_RETRIES) break;
        this.render({
          type: "kerja",
          sentence: `Koneksi terputus. Nemu mencoba lagi (${attempt + 1} dari ${MAX_RETRIES}).`,
          status: { tone: "unsaved", text: "Menyambung lagi" },
          slow: this.state.slow,
          onSlow: () => this.setSlow(!this.state.slow),
          onStop: () => this.askToStop(),
        });
        await this.sleep(RETRY_MS * (attempt + 1), signal);
      }
    }
    this.halt("offline");
    this.deps.log({ action: "stop", target: "", result: "failed" });
    this.render({
      type: "jawab",
      sentence: "Koneksi terputus, jadi Nemu berhenti dulu. Isian tetap ada.",
      notes: { kenapa: "Katakan “lanjut” atau tekan Lanjut kalau koneksi sudah kembali." },
      action: { label: "Lanjut", onSelect: () => this.resume() },
      onClose: () => this.stop(),
    });
    throw new Interrupted();
  }

  /** F0-06: wait for the target a little (a page may still be loading), then report what was found. */
  private async locate(step: ExecutorStep, signal: AbortSignal): Promise<TargetLookup> {
    for (let waited = 0; ; waited += LOCATE_POLL_MS) {
      const lookup = findTarget(this.deps.doc, step.target);
      if (lookup.status === "found" || waited >= LOCATE_MS) return lookup;
      await this.sleep(LOCATE_POLL_MS, signal);
    }
  }

  private async step(index: number, signal: AbortSignal) {
    const step = this.state.task.steps[index] as ExecutorStep;
    const lookup = await this.locate(step, signal);
    if (lookup.status !== "found") return this.askAbout(lookup, describeTarget(step.target));
    const { element, name } = lookup;
    bringIntoView(element);

    const refused = this.state.refused.includes(index) || refusalFor(step, element) !== null;
    if (refused) {
      this.deps.log({ action: step.verb, target: name, result: "refused" });
      const teacher = this.deps.honorific || "Anda";
      return this.pointAndWait(
        index,
        element,
        name,
        `Yang ini ${teacher} tekan sendiri. Nemu hanya menunjuk.`,
        true,
        signal,
      );
    }
    if (step.verb === "point")
      return this.pointAndWait(
        index,
        element,
        name,
        step.sentence,
        false,
        signal,
        step.ringkasan,
        step.sumber,
        step,
      );
    if (step.verb === "scroll") {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      this.deps.log({ action: "scroll", target: name, result: "done" });
      return;
    }
    if (!sitePermits(this.deps.permission ?? "read_fill", step.verb)) {
      // WS-03 "baca saja" / "siapkan pesan": Nemu points and says it; the teacher does it.
      this.deps.log({ action: step.verb, target: name, result: "refused" });
      return this.teach2(index, step, element, name, signal);
    }
    if (this.state.cara === 2) return this.teach2(index, step, element, name, signal);
    return this.act(index, step, element, name, signal);
  }

  /** F0-06: a missing or ambiguous target stops Nemu, which asks what to do. */
  private askAbout(lookup: TargetLookup, description: string): never {
    this.halt("asking");
    const problem =
      lookup.status === "ambiguous"
        ? `Ada ${lookup.count} ${description} di halaman ini.`
        : `Nemu tidak menemukan ${description} di halaman ini.`;
    this.render({
      type: "pilih",
      question: `${problem} Lanjut bagaimana?`,
      choices: [
        { id: "ulang", label: "Coba lagi" },
        { id: "sendiri", label: "Saya kerjakan sendiri", risky: true },
        { id: "berhenti", label: "Berhenti" },
      ],
      onChoose: (id) => {
        if (id === "ulang") return this.resume();
        if (id === "berhenti") return this.stop();
        this.state.events.push({ kind: "skipped", name: description });
        this.state.index += 1;
        this.resume();
      },
    });
    throw new Interrupted();
  }

  /** The teacher's turn: point and wait until she presses it herself. */
  private async pointAndWait(
    index: number,
    element: Element,
    name: string,
    sentence: string,
    refused: boolean,
    signal: AbortSignal,
    ringkasan?: string,
    sumber?: string,
    turn: { heading?: string; detail?: string; chip?: string; ringkasanCard?: RingkasanCard } = {},
  ) {
    this.waiting = { refused };
    // Gelembung Tunjuk carries one link: the numbers behind it, else where the step came from.
    const note = ringkasan ? { ringkasan } : sumber ? { sumber: [sumber] } : undefined;
    const status = turn.heading ? { text: turn.heading } : undefined;
    const { detail, chip, ringkasanCard: card } = turn;
    const bubble = (): NemuDisplay => ({
      type: "tunjuk",
      sentence,
      note,
      status,
      detail,
      chip,
      // F1·11a: Lihat ringkasan opens its own Kartu Info; Kembali comes back here. Nemu keeps
      // waiting for her press on the target the whole time.
      ...(card ? { link: { label: "Lihat ringkasan", onSelect: () => showCard(card) } } : {}),
    });
    const showCard = (summary: RingkasanCard) => {
      this.render(
        {
          type: "info",
          status: { text: "Ringkasan" },
          ...summary,
          closeLabel: "Kembali",
          onClose: () => this.render(bubble(), element),
        },
        element,
      );
      this.deps.speak(summary.title);
    };
    this.render(bubble(), element);
    this.deps.speak(sentence);
    await waitForEvent(
      this.deps.doc,
      ["click"],
      (event) => this.trusted(event) && element.contains(event.target as Node),
      signal,
    );
    // Her press sends its form after this listener's turn; while Nemu still waits for her, the
    // submit guard (F0-08) lets it through instead of taking it for Nemu's own.
    await this.sleep(0, signal);
    this.waiting = null;
    // The press may load another page, so the run moves past this step before the page reacts.
    this.state.events.push({ kind: "pressed", name, refused });
    this.state.index = index + 1;
    this.save();
    this.deps.log({ action: "point", target: name, result: "teacher" });
  }

  private tick(index: number, element: Element) {
    this.tickElements.set(index, element);
    if (!this.state.ticked.includes(index)) this.state.ticked.push(index);
  }

  /**
   * Where a value step is: the row it fills among the task's rows ("3 dari 32" students, however
   * many Catatan go with them), or, for values that aren't in rows, among the values.
   */
  private progress(index: number): NemuStatus["progress"] {
    const steps = this.state.task.steps;
    const rows = [...new Set(steps.map(rowOf).filter((row) => row !== undefined))];
    const row = rowOf(steps[index]);
    if (row !== undefined) return { done: rows.indexOf(row) + 1, total: rows.length };
    if (rows.length) {
      // A value beside the rows (a Catatan found by its label): the row before it.
      const before = new Set(
        steps
          .slice(0, index)
          .map(rowOf)
          .filter((at) => at !== undefined),
      );
      return { done: Math.max(before.size, 1), total: rows.length };
    }
    const fills = steps
      .map((step, at) => ({ step, at }))
      .filter(({ step }) => step.verb === "setValue");
    const done = fills.filter(({ at }) => at < index).length;
    return { done: done + 1, total: fills.length };
  }

  /**
   * Cara 1's line for a student's value (F1·07, P1-5): "Alya Nur Fitri, 90." for the first rows,
   * with the way to take over under it; from the fourth row "Sisanya saya isi lebih cepat, Bu."
   * unless Pelan is on. A row with several values names the column: "Bagas: Fashohah 80." Null
   * for a value without a student (a Catatan), which keeps the row's line.
   */
  private rowLine(
    index: number,
    step: Extract<ExecutorStep, { verb: "setValue" }>,
  ): { sentence: string; detail: string; readAloud: boolean } | null {
    if (step.rowName === undefined) return null;
    const row = this.progress(index)?.done ?? 1;
    const address = addressFor(this.deps.honorific);
    if (row > READ_ROWS && !this.state.slow) {
      const honorific = this.deps.honorific ? `, ${this.deps.honorific}` : "";
      return {
        sentence: `Sisanya saya isi lebih cepat${honorific}.`,
        detail: "Tekan Pelan untuk melihat satu per satu.",
        readAloud: false,
      };
    }
    const value = step.value === "" ? "dikosongkan" : step.value;
    const fields = this.state.task.steps.filter(
      (other) => other.verb === "setValue" && other.rowName === step.rowName,
    ).length;
    const column = step.target.column ?? step.target.label;
    return {
      sentence:
        fields > 1 && column
          ? `${step.rowName}: ${column} ${value}.`
          : `${step.rowName}, ${value}.`,
      detail: `Klik atau ketik kalau ${address} mau isi sendiri.`,
      readAloud: row <= READ_ROWS,
    };
  }

  /** Gelembung Kerja while Nemu works: [Pelan] and [Berhenti]. */
  private working(sentence: string, detail: string | undefined, status: NemuStatus): NemuDisplay {
    return {
      type: "kerja",
      sentence,
      ...(detail ? { detail } : {}),
      status,
      slow: this.state.slow,
      onSlow: () => this.setSlow(!this.state.slow),
      onStop: () => this.askToStop(),
    };
  }

  /** Cara 1: Nemu does the step itself, at the fill speed. */
  private async act(
    index: number,
    step: Exclude<ExecutorStep, { verb: "point" | "scroll" }>,
    element: Element,
    name: string,
    signal: AbortSignal,
  ) {
    const started = Date.now();
    const unit = this.state.slow ? 2 : 1;
    const row =
      step.verb === "setValue" && step.sentence === undefined ? this.rowLine(index, step) : null;
    // The task's own words for the step when it has them (F1·05a–06b), else the executor's.
    const sentence =
      step.sentence ??
      row?.sentence ??
      {
        clickMenu: `Membuka ${name}…`,
        selectOption: `Memilih ${"option" in step ? step.option : ""}.`,
        check:
          "checked" in step && !step.checked ? `Menghapus centang ${name}.` : `Mencentang ${name}.`,
        setValue: `Mengisi ${name}.`,
      }[step.verb];
    const status: NemuStatus = step.stage
      ? {
          tone: "working",
          text: step.stage.label ?? (step.verb === "setValue" ? "Nemu mengisi" : "Nemu bekerja"),
          count: `Langkah ${step.stage.n} dari ${step.stage.of}`,
          progress: { done: step.stage.n, total: step.stage.of },
        }
      : step.verb === "setValue"
        ? { tone: "working", text: "Nemu mengisi", progress: this.progress(index) }
        : {
            tone: "working",
            text: step.verb === "clickMenu" ? "Nemu membuka menu" : "Nemu mengisi",
          };
    if (step.approach) {
      // Said before the cursor sets off, beside the Nemu button: "Saya buka menu Nilai, Bu."
      this.render(this.working(step.approach.sentence, step.approach.detail, status));
      this.deps.speak(step.approach.sentence);
      await this.sleep(wordCount(step.approach.sentence) * WORD_MS * unit, signal);
    }
    const shown = this.view.display;
    if (
      step.verb === "setValue" &&
      step.sentence === undefined &&
      step.rowName === undefined &&
      step.target.row !== undefined &&
      shown?.type === "kerja"
    )
      // A student's Catatan keeps the line of the student's value.
      this.render(shown, element);
    else this.render(this.working(sentence, step.detail ?? row?.detail, status), element);
    if (row && !row.readAloud && !this.saidFaster) {
      this.saidFaster = true;
      this.deps.speak(row.sentence);
    }
    await this.sleep(CURSOR_GLIDE_MS, signal);

    switch (step.verb) {
      case "clickMenu":
        // The cursor has arrived and the line is up: say it and let her read it, then click.
        this.deps.speak(sentence);
        await this.sleep(NAVIGATE_READ_MS * unit, signal);
        // F0-13: the run moves on before the click, since the menu may load another page.
        this.state.events.push({ kind: "acted", verb: "clickMenu", name });
        this.state.index = index + 1;
        this.save();
        this.deps.log({ action: "clickMenu", target: name, result: "done" });
        if (element instanceof HTMLElement) element.click();
        await this.sleep(SETTLE_MS * unit, signal);
        return;
      case "selectOption":
        if (!chooseOption(element, step.option))
          return this.askAbout({ status: "missing" }, `pilihan ${step.option} di ${name}`);
        this.state.events.push({ kind: "acted", verb: "selectOption", name, option: step.option });
        break;
      case "check":
        setChecked(element, step.checked);
        this.state.events.push({
          kind: "acted",
          verb: "check",
          name,
          ...(step.checked ? {} : { unchecked: true }),
        });
        // A switch may load another page (Moodle's Mode Edit), so the run moves on now (F0-13).
        this.state.index = index + 1;
        this.save();
        break;
      case "setValue": {
        if (!isValueField(element)) return this.askAbout({ status: "missing" }, name);
        await typeValue(element, step.value, () => this.sleep(CHAR_MS * unit, signal));
        this.state.events.push({ kind: "acted", verb: "setValue", name });
        this.tick(index, element);
        this.render(this.view.display, element);
        // The first rows are read aloud as they are filled; the rest go faster, unspoken.
        if (row?.readAloud) {
          this.deps.speak(row.sentence);
          await this.sleep(wordCount(row.sentence) * WORD_MS * unit, signal);
        }
        break;
      }
    }
    if (step.verb !== "setValue") this.tick(index, element);
    this.deps.log({ action: step.verb, target: name, result: "done" });
    const rest = this.deps.fieldMs * unit - (Date.now() - started);
    if (rest > 0) await this.sleep(rest, signal);
  }

  /** Cara 2: Nemu points and says the value; the teacher does it, and Nemu checks. */
  private async teach2(
    index: number,
    step: Exclude<ExecutorStep, { verb: "point" | "scroll" }>,
    element: Element,
    name: string,
    signal: AbortSignal,
  ) {
    // Giliran Ibu (F1·09): the stage's "Langkah 1 dari 3", or for a student's value the row,
    // "4 dari 32".
    const progress = step.verb === "setValue" && !step.stage ? this.progress(index) : undefined;
    const status: NemuStatus = {
      text: `Giliran ${addressFor(this.deps.honorific)}`,
      ...(step.stage
        ? { count: `Langkah ${step.stage.n} dari ${step.stage.of}` }
        : progress
          ? { count: `${progress.done} dari ${progress.total}` }
          : {}),
    };
    const say = (sentence: string, detail?: string) => {
      this.render({ type: "tunjuk", sentence, ...(detail ? { detail } : {}), status }, element);
      this.deps.speak(sentence);
    };
    this.waiting = { refused: false };
    let corrected = false;
    if (step.verb !== "clickMenu" && this.alreadyDone(step, element)) {
      this.waiting = null;
      this.tick(index, element);
      this.save();
      return;
    }
    switch (step.verb) {
      case "clickMenu":
        say(`Klik ${name}.`);
        await waitForEvent(
          this.deps.doc,
          ["click"],
          (event) => this.trusted(event) && element.contains(event.target as Node),
          signal,
        );
        this.state.index = index + 1;
        break;
      case "selectOption":
        say(`Pilih ${step.option} di ${name}.`);
        await waitForEvent(
          element,
          ["change"],
          () => {
            if (sameValue(currentValue(element), step.option)) return true;
            say(`Pilih ${step.option}.`);
            return false;
          },
          signal,
        );
        break;
      case "check":
        say(step.checked ? `Centang ${name}.` : `Hapus centang ${name}.`);
        await waitForEvent(
          element,
          ["change", "click"],
          () => isChecked(element) === step.checked,
          signal,
        );
        break;
      case "setValue":
        if (this.deps.guide) {
          corrected = await this.guided(step, element, name, this.deps.guide, say, signal);
          break;
        }
        say(
          step.rowName
            ? `Ketik ${step.value} untuk ${step.rowName}.`
            : `Ketik ${step.value} di ${name}.`,
        );
        await waitForEvent(
          element,
          ["input", "change"],
          (event) => {
            if (sameValue(currentValue(element), step.value)) return true;
            if (event.type === "change") say(`Di daftar tertulis ${step.value}.`);
            return false;
          },
          signal,
        );
        break;
    }
    this.waiting = null;
    if (VALUE_VERBS.has(step.verb)) this.tick(index, element);
    this.state.events.push({
      kind: "taught",
      verb: step.verb,
      name,
      ...(corrected ? { corrected } : {}),
    });
    this.save();
    this.deps.log({ action: step.verb, target: name, result: "teacher" });
  }

  /**
   * Cara 2 with the task's own words (F1-11): Nemu says the guide's line, and each time the
   * teacher leaves the field it checks what she typed; a difference is said gently and Nemu waits
   * for the fix. True when Nemu had to correct her.
   */
  private async guided(
    step: GuidedStep,
    element: Element,
    name: string,
    guide: CaraTwoGuide,
    say: (sentence: string, detail?: string) => void,
    signal: AbortSignal,
  ): Promise<boolean> {
    const prompt = await guide.prompt(step).catch(() => null);
    if (signal.aborted) throw new Interrupted();
    if (prompt) say(prompt.sentence, prompt.detail);
    else
      say(
        step.rowName
          ? `Ketik ${step.value} untuk ${step.rowName}.`
          : `Ketik ${step.value} di ${name}.`,
      );
    const left = async () => {
      await waitForEvent(element, ["change"], () => true, signal);
      return currentValue(element);
    };
    let corrected = false;
    let typed = await left();
    for (;;) {
      const verdict: GuideLine & { ok: boolean } = (await guide
        .check(step, typed)
        .catch(() => null)) ?? {
        ok: sameValue(typed, step.value),
        sentence: `Di daftar tertulis ${step.value}.`,
      };
      if (signal.aborted) throw new Interrupted();
      // She changed it again while Nemu was checking: check the newer value.
      const now = currentValue(element);
      if (now !== typed) {
        typed = now;
        continue;
      }
      if (verdict.ok) return corrected;
      corrected = true;
      say(verdict.sentence, verdict.detail);
      typed = await left();
    }
  }

  /** The field already holds what the step would put there, so there is nothing to teach. */
  private alreadyDone(step: ExecutorStep, element: Element): boolean {
    if (step.verb === "check") return isChecked(element) === step.checked;
    if (step.verb === "selectOption") return sameValue(currentValue(element), step.option);
    if (step.verb === "setValue") return sameValue(currentValue(element), step.value);
    return false;
  }

  /** Cara 3: the teacher fills alone; once she presses Simpan, Nemu checks every value. */
  private async checkAfterSave(signal: AbortSignal) {
    const steps = this.state.task.steps;
    const save = [...steps].reverse().find((step) => step.verb === "point");
    const saveName = save ? describeTarget(save.target) : "Simpan";
    const teacher = this.deps.honorific || "Anda";
    this.waiting = { refused: false };
    this.render({
      type: "jawab",
      sentence: `Silakan ${teacher} isi sendiri. Nemu memeriksa setelah ${teacher} menekan ${saveName}.`,
      onClose: () => this.stop(),
    });
    await waitForEvent(
      this.deps.doc,
      ["click"],
      (event) => {
        if (!this.trusted(event) || !save) return false;
        const lookup = findTarget(this.deps.doc, save.target);
        return lookup.status === "found" && lookup.element.contains(event.target as Node);
      },
      signal,
    );
    this.waiting = null;

    const mismatches: string[] = [];
    const checked = steps.filter((step) => VALUE_VERBS.has(step.verb));
    for (const step of checked) {
      const lookup = findTarget(this.deps.doc, step.target);
      const name = describeTarget(step.target);
      const expected =
        step.verb === "setValue" ? step.value : step.verb === "selectOption" ? step.option : null;
      const fits =
        lookup.status === "found" &&
        (step.verb === "check"
          ? isChecked(lookup.element) === step.checked
          : sameValue(currentValue(lookup.element), expected ?? ""));
      this.deps.log({ action: step.verb, target: name, result: "teacher" });
      if (fits) continue;
      const actual = lookup.status === "found" ? currentValue(lookup.element) : "";
      mismatches.push(
        step.verb === "check"
          ? `${name}: ${step.checked ? "belum dicentang" : "masih dicentang"}`
          : `${name}: tertulis ${actual || "kosong"}, di daftar ${expected}`,
      );
    }
    this.state.events.push({ kind: "pressed", name: saveName, refused: false });
    this.state.events.push({
      kind: "checked",
      total: checked.length,
      mismatched: mismatches.length,
    });
    this.state.index = steps.length;
    this.save();

    const showNotes = await new Promise<boolean>((resolve) => {
      this.render({
        type: "jawab",
        sentence:
          mismatches.length === 0
            ? `Semua ${checked.length} isian sudah sesuai.`
            : `${mismatches.length} dari ${checked.length} isian belum sesuai.`,
        notes: mismatches.length ? { ringkasan: mismatches.join("; ") } : undefined,
        action: { label: "Catatan langkah", onSelect: () => resolve(true) },
        onClose: () => resolve(false),
      });
    });
    if (!signal.aborted) this.end("done", showNotes);
  }

  private end(outcome: RunOutcome, showNotes = true) {
    this.controller.abort();
    this.waiting = null;
    this.state.status = outcome;
    this.save();
    this.deps.log({
      action: outcome === "done" ? "finish" : "stop",
      target: "",
      result: outcome === "done" ? "done" : "stopped",
    });
    const notes = stepNotes({
      task: this.state.task,
      events: this.state.events,
      outcome,
      index: this.state.index,
      honorific: this.deps.honorific,
    });
    this.tickElements.clear();
    this.render(null);
    this.deps.onEnd(this.state, notes, showNotes);
  }
}
