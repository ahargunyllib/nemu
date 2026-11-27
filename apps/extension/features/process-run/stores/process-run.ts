import { matchFieldLabels } from "@nemu/ai/school/bpmn/fields";
import type { BpmnPlan, FormPhotoQuestion, FormTable, InboxJob } from "@nemu/contracts/school";
import type { NemuChoice, NemuDisplay } from "@nemu/ui/lib/nemu-display";

import type { ProcessSlots } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import type { RunState } from "../../executor/lib/run";
import { executor } from "../../executor/stores/executor";
import { addressFor } from "../../grade-photo/lib/grade-task";
import { requestProcessRun } from "../api/request-process-run";
import { findTarget } from "../../executor/lib/find-target";
import {
  canRun,
  type LabelMatcher,
  nextProcessSteps,
  pagePath,
  PROCESS_TASK_KIND,
  type ProcessContinuation,
  processTask,
} from "../lib/process-task";
import type { ProcessRunRequest, ProcessRunValue } from "../lib/requests";

/**
 * F3 (#213): a process the school uploaded as BPMN, from the teacher's words to the button only
 * she presses. Nemu shows the steps first (F3-15), asks for what the words left out, reads a
 * photo against the task's own fields (F3-16) and asks what it can't read, then hands the steps
 * to the executor, which opens the task's page and fills it by the page's labels (F3-17, F3-19).
 * Other roles' and the system's tasks are only named (F3-18). Nothing here knows any one process.
 */

/** The visible tab looks for the photo every few seconds while Nemu waits for it. */
const POLL_MS = 4000;

export type ProcessRunView = {
  display: NemuDisplay | null;
  /** The type box goes under the display: Nemu waits for a typed or spoken answer. */
  typing: boolean;
  /** A flow is under way, so the F1 photo card stays out of the way. */
  active: boolean;
};

type Phase =
  | { name: "idle" }
  | { name: "working"; sentence: string }
  | { name: "notice"; sentence: string; retry?: () => void }
  | { name: "asking"; question: string; slot: string }
  /** `missingMenu`: the page path's first menu isn't on this page, so Nemu only explains. */
  | { name: "overview"; missingMenu?: string }
  | { name: "photo"; question: string; slot: string; message?: string }
  | { name: "checking"; index: number; misheard?: boolean }
  | { name: "number"; index: number; misheard?: boolean }
  | { name: "running" };

/** Kept in the background while the executor runs, for Catatan langkah after a page load. */
type Kept = { jobId: string | null; announcements: string[]; processName: string };

type Context = { pageEmail: PageEmail; honorific: string; speak: (text: string) => void };

const OTHER_NUMBER = "angka-lain";
const LEAVE_EMPTY = "kosongkan";
const NOT_LISTED = "tidak-ada";
const AS_WRITTEN = "seperti-tertulis";

function numberIn(text: string): string | null {
  return text.match(/\d+/u)?.[0] ?? null;
}

function createProcessRun() {
  const listeners = new Set<() => void>();
  let context: Context = { pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} };
  let view: ProcessRunView = { display: null, typing: false, active: false };
  let phase: Phase = { name: "idle" };
  let documentId = "";
  let processName = "";
  let plan: BpmnPlan | null = null;
  let slots: ProcessSlots = {};
  let table: FormTable | null = null;
  let overviewShown = false;
  let jobId: string | null = null;
  let questions: FormPhotoQuestion[] = [];
  let crops: (string | null)[] = [];
  let kept: Kept | null = null;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  /** Bumped by every cancel, so a reply that comes back after it is dropped. */
  let generation = 0;

  const address = () => addressFor(context.honorific);
  const call = <R extends ProcessRunRequest>(request: R) =>
    requestProcessRun(context.pageEmail, request);

  // --- What the page shows ----------------------------------------------------------------------

  function questionChoices(question: FormPhotoQuestion): [NemuChoice, NemuChoice, ...NemuChoice[]] {
    const options = question.candidates.map((value) => ({ id: `nilai:${value}`, label: value }));
    if (question.kind === "name") {
      const rest = [{ id: NOT_LISTED, label: "Tidak ada di daftar" }];
      if (options.length < 1) rest.push({ id: AS_WRITTEN, label: "Biarkan seperti tertulis" });
      return [...options, ...rest].slice(0, 3) as [NemuChoice, NemuChoice];
    }
    const rest = [{ id: OTHER_NUMBER, label: "Angka lain" }];
    if (options.length < 2) rest.push({ id: LEAVE_EMPTY, label: "Kosongkan" });
    return [...options, ...rest].slice(0, 3) as [NemuChoice, NemuChoice];
  }

  function displayFor(): NemuDisplay | null {
    const close = () => cancel();
    switch (phase.name) {
      case "idle":
      case "running":
        return null;
      case "working":
        return {
          type: "kerja",
          sentence: phase.sentence,
          status: { tone: "working", text: "Nemu membaca" },
          onSlow: () => undefined,
          onStop: close,
        };
      case "notice":
        return {
          type: "jawab",
          sentence: phase.sentence,
          action: phase.retry ? { label: "Coba lagi", onSelect: phase.retry } : undefined,
          onClose: close,
        };
      case "asking":
        return { type: "jawab", sentence: phase.question, onClose: close };
      case "overview": {
        const runnable = !!plan && canRun(plan) && !phase.missingMenu;
        const items = [...(plan?.overview ?? [])];
        if (phase.missingMenu)
          items.push(
            `Nemu belum menemukan menu “${phase.missingMenu}” di halaman ini, jadi Nemu hanya menjelaskan.`,
          );
        else if (!runnable)
          items.push("Nemu belum tahu halaman langkah ini, jadi Nemu hanya menjelaskan.");
        return {
          type: "info",
          title: `Langkah ${processName}`,
          items,
          link: runnable ? { label: "Mulai", onSelect: () => void begin() } : undefined,
          onClose: runnable ? close : () => reset(),
        };
      }
      case "photo":
        return {
          type: "jawab",
          sentence:
            phase.message ??
            `Kirim fotonya ke WhatsApp Nemu, ${address()}. Atau jawab: ${phase.question}`,
          status: { tone: "working", text: "Menunggu foto" },
          onClose: close,
        };
      case "checking": {
        const index = phase.index;
        const question = questions[index];
        if (!question) return null;
        const crop = crops[index];
        return {
          type: "pilih",
          question: phase.misheard ? `Nemu belum menangkap. ${question.prompt}` : question.prompt,
          choices: questionChoices(question) as unknown as readonly [NemuChoice, NemuChoice],
          onChoose: (id) => choose(index, id),
          image: crop ? { src: crop, alt: `Foto, baris ${question.rowName}` } : undefined,
          note: `Pertanyaan ${index + 1} dari ${questions.length}.`,
        };
      }
      case "number": {
        const index = phase.index;
        const question = questions[index];
        const what = question?.kind === "value" ? `${question.label} ${question.rowName}` : "nilainya";
        return {
          type: "jawab",
          sentence: phase.misheard
            ? `Nemu belum menangkap angkanya. Berapa ${what}?`
            : `Berapa ${what}, ${address()}? Ketik atau sebutkan angkanya.`,
          onClose: () => setPhase({ name: "checking", index }),
        };
      }
    }
  }

  function publish() {
    view = {
      display: displayFor(),
      typing: ["asking", "photo", "number"].includes(phase.name),
      active: phase.name !== "idle",
    };
    for (const listener of listeners) listener();
  }

  function setPhase(next: Phase, spoken?: string) {
    phase = next;
    if (next.name !== "photo") stopPolling();
    publish();
    if (spoken) context.speak(spoken);
  }

  function notice(sentence: string, retry?: () => void) {
    setPhase({ name: "notice", sentence, retry }, sentence);
  }

  // --- The flow ---------------------------------------------------------------------------------

  /** helpRoute said `proses` for these words: "Catat setoran hafalan 4A hari ini". */
  async function start(utterance: string, name: string) {
    reset();
    const run = generation;
    processName = name;
    setPhase({ name: "working", sentence: `Nemu membaca proses ${name}…` });
    const found = await call({ op: "find", processName: name });
    if (run !== generation) return;
    if (!found.ok) return notice(found.message);
    const process = found.value as ProcessRunValue["find"];
    if (!process) return notice(`Proses ${name} belum aktif di Nemu, ${address()}.`);
    documentId = process.documentId;
    processName = process.title;
    await planWith(utterance, null);
  }

  async function planWith(text: string | null, answering: string | null) {
    const run = generation;
    const response = await call({
      op: "plan",
      input: { documentId, text, answering, slots, stepIndex: 0, table },
    });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message, () => void planWith(text, answering));
    handle(response.value as ProcessRunValue["plan"]);
  }

  function handle(next: BpmnPlan) {
    plan = next;
    slots = next.slots;
    const step = next.step;
    const forTeacherTask = step.kind === "ask" && next.tasks.some((task) => task.taskId === step.taskId);
    // What kind of process this is (a start form, a branch) is asked before the steps are shown.
    if (step.kind === "ask" && !forTeacherTask)
      return setPhase({ name: "asking", question: step.question, slot: step.slot }, step.question);
    if (!overviewShown) {
      overviewShown = true;
      return setPhase({ name: "overview" }, `Ini langkah ${processName}, ${address()}.`);
    }
    if (step.kind === "ask") {
      // A field the photo didn't have: asked one at a time, as typed or spoken words.
      if (jobId) return setPhase({ name: "asking", question: step.question, slot: step.slot }, step.question);
      return void needData(step.question, step.slot);
    }
    void execute();
  }

  /** Mulai: the overview was read. */
  async function begin() {
    if (!plan) return;
    const step = plan.step;
    if (step.kind === "ask") return needData(step.question, step.slot);
    void execute();
  }

  /** The task's fields aren't known yet: a photo in the inbox answers them, else Nemu waits. */
  async function needData(question: string, slot: string) {
    const run = generation;
    const response = await call({ op: "jobs" });
    if (run !== generation) return;
    const jobs = response.ok ? (response.value as InboxJob[]) : [];
    const waiting = jobs.find((job) => job.status === "queued");
    if (waiting) return readPhoto(waiting.jobId);
    setPhase({ name: "photo", question, slot }, `Kirim fotonya ke WhatsApp Nemu, ${address()}.`);
    startPolling();
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => void poll(), POLL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  async function poll() {
    if (phase.name !== "photo" || document.visibilityState !== "visible") return;
    const run = generation;
    const response = await call({ op: "jobs" });
    if (run !== generation || phase.name !== "photo" || !response.ok) return;
    const waiting = (response.value as InboxJob[]).find((job) => job.status === "queued");
    if (waiting) void readPhoto(waiting.jobId);
  }

  async function readPhoto(id: string) {
    if (!plan || plan.step.kind !== "ask") return;
    const run = generation;
    const asked = plan.step;
    jobId = id;
    setPhase({ name: "working", sentence: "Nemu membaca fotonya…" });
    const response = await call({
      op: "read-photo",
      documentId,
      jobId: id,
      taskId: asked.taskId,
      slots,
    });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message, () => void readPhoto(id));
    const result = response.value as ProcessRunValue["read-photo"];
    if (result.status === "reshoot") {
      // That photo goes; the next one the teacher sends is read.
      void call({ op: "ack", jobId: id });
      jobId = null;
      setPhase(
        { name: "photo", question: asked.question, slot: asked.slot, message: result.message },
        result.message,
      );
      return startPolling();
    }
    slots = result.slots;
    table = result.table;
    questions = result.questions;
    if (!questions.length) return planWith(null, null);
    const cropped = await call({
      op: "crops",
      jobId: id,
      boxes: questions.map((question) => question.box),
    });
    if (run !== generation) return;
    crops = cropped.ok ? (cropped.value as (string | null)[]) : [];
    ask(0);
  }

  function ask(index: number, misheard = false) {
    const question = questions[index];
    if (!question) return void planWith(null, null);
    setPhase(
      { name: "checking", index, misheard },
      misheard ? `Nemu belum menangkap. ${question.prompt}` : question.prompt,
    );
  }

  /** The teacher's answer to a photo question goes into the table, never a guess of Nemu's. */
  function settle(index: number, answer: { value: string } | { name: string | null }) {
    const question = questions[index];
    if (!question || !table) return;
    table = {
      ...table,
      rows: table.rows.flatMap((row) => {
        if (row.name !== question.rowName) return [row];
        if ("name" in answer) return answer.name ? [{ ...row, name: answer.name }] : [];
        if (question.kind !== "value") return [row];
        const values = { ...row.values };
        if (answer.value) values[question.fieldId] = answer.value;
        else delete values[question.fieldId];
        return [{ ...row, values }];
      }),
    };
    ask(index + 1);
  }

  function choose(index: number, id: string) {
    const question = questions[index];
    if (!question) return;
    if (id.startsWith("nilai:")) {
      const value = id.slice("nilai:".length);
      return settle(index, question.kind === "name" ? { name: value } : { value });
    }
    if (id === OTHER_NUMBER) {
      const what = question.kind === "value" ? `${question.label} ${question.rowName}` : "nilainya";
      return setPhase({ name: "number", index }, `Berapa ${what}, ${address()}?`);
    }
    if (id === LEAVE_EMPTY) return settle(index, { value: "" });
    if (id === NOT_LISTED) return settle(index, { name: null });
    if (id === AS_WRITTEN) return settle(index, { name: question.rowName });
  }

  /** Hands the first teacher task to the executor; its page comes from the plan (F3-19). */
  async function execute() {
    if (!plan) return;
    const task = plan.tasks[0];
    if (!task || !canRun(plan)) return setPhase({ name: "overview" });
    // A page from WS-04 that this site doesn't show (a label never corrected): explain only.
    const [menu] = pagePath(task.page ?? "");
    if (menu && findTarget(document, { text: menu }).status === "missing")
      return setPhase({ name: "overview", missingMenu: menu });
    const built = processTask({
      plan,
      task,
      honorific: context.honorific,
      source: jobId ? `Proses ${processName} dan foto dari WhatsApp` : `Proses ${processName}`,
    });
    kept = { jobId, announcements: plan.announcements, processName };
    void call({ op: "state-save", state: kept });
    setPhase({ name: "running" });
    await executor.start(built.task, { continuation: built.continuation });
  }

  /** The run ended: name what others do next (F3-18), let the photo go, show Catatan langkah. */
  function afterRun(ended: RunState, notes: string[], show: boolean) {
    void (async () => {
      kept ??= await loadKept();
      const items = [...notes];
      if (ended.status === "done" && kept) {
        for (const next of kept.announcements) items.push(`Berikutnya, bukan tugas Nemu: ${next}`);
        if (kept.jobId) {
          const acked = await call({ op: "ack", jobId: kept.jobId });
          items.push(acked.ok ? "Foto dihapus dari Nemu" : "Foto belum terhapus");
        }
      }
      void call({ op: "state-save", state: null });
      reset();
      executor.presentNotes(items, ended.startCara === 1 ? ended.task.kind : null, show);
    })();
  }

  async function loadKept(): Promise<Kept | null> {
    const response = await call({ op: "state-load" });
    return response.ok ? ((response.value as Kept | null) ?? null) : null;
  }

  function reset() {
    generation += 1;
    stopPolling();
    documentId = "";
    plan = null;
    slots = {};
    table = null;
    overviewShown = false;
    jobId = null;
    questions = [];
    crops = [];
    kept = null;
    setPhase({ name: "idle" });
  }

  function cancel() {
    void call({ op: "state-save", state: null });
    reset();
  }

  // F3-17: the page's labels for the BPMN fields, from the Nemu Service; offline, the code's match.
  const matchLabels: LabelMatcher = async (fields, pageLabels) => {
    const response = await call({ op: "match-fields", fields, pageLabels });
    return response.ok
      ? (response.value as Record<string, string | null>)
      : matchFieldLabels(fields, pageLabels);
  };
  executor.registerStepSource(PROCESS_TASK_KIND, (continuation) =>
    nextProcessSteps(document, continuation as ProcessContinuation, matchLabels),
  );
  executor.registerFinisher(PROCESS_TASK_KIND, afterRun);

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,

    connect(next: Context) {
      context = next;
    },

    start,

    /**
     * Words the teacher typed or said while Nemu waits for an answer. False when Nemu isn't
     * waiting, so the words go to the panel as a question instead.
     */
    hear(text: string): boolean {
      switch (phase.name) {
        case "asking":
        case "photo":
          void planWith(text, phase.slot);
          return true;
        case "checking": {
          const index = phase.index;
          const question = questions[index]!;
          const said = question.kind === "value" ? numberIn(text) : null;
          const named = question.candidates.find((candidate) =>
            text.toLocaleLowerCase("id-ID").includes(candidate.toLocaleLowerCase("id-ID")),
          );
          if (named) choose(index, `nilai:${named}`);
          else if (said) settle(index, { value: said });
          else ask(index, true);
          return true;
        }
        case "number": {
          const value = numberIn(text);
          if (value) settle(phase.index, { value });
          else setPhase({ ...phase, misheard: true }, "Nemu belum menangkap angkanya.");
          return true;
        }
        default:
          return false;
      }
    },

    cancel,
  };
}

/** The page's one F3 flow (#213). */
export const processRun = createProcessRun();
