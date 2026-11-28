import { matchFieldLabels } from "@nemu/ai/school/bpmn/fields";
import type {
  BpmnPlan,
  FormPhotoQuestion,
  FormTable,
  FormTableRow,
  InboxJob,
} from "@nemu/contracts/school";
import type { NemuChoice, NemuDisplay } from "@nemu/ui/lib/nemu-display";

import type { ProcessReadback, ProcessSlots } from "../../../shared/api/nemu-service";
import { adminUrl } from "../../../shared/lib/config";
import type { PageEmail } from "../../../shared/lib/messages";
import { type NotesCard, recipeCard } from "../../executor/lib/recipe";
import type { RunState } from "../../executor/lib/run";
import { executor } from "../../executor/stores/executor";
import { addressFor } from "../../grade-photo/lib/grade-task";
import { requestProcessRun } from "../api/request-process-run";
import { findTarget } from "../../executor/lib/find-target";
import {
  afterLine,
  canRun,
  type LabelMatcher,
  nextProcessSteps,
  pagePath,
  PROCESS_TASK_KIND,
  type ProcessContinuation,
  processTask,
} from "../lib/process-task";
import { procedureTask } from "../lib/procedure-task";
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
type Kept = {
  jobId: string | null;
  announcements: string[];
  processName: string;
  /** F3·08: what to read back after she saves, and the steps that become the recipe. */
  check?: { rows: FormTableRow[]; className: string | null; date: string | null; recipe: string[] };
};

/** How long Nemu waits for the save to show in AlurSekolah (her press, then the confirmation). */
const READBACK_TRIES = 15;
const READBACK_MS = 2000;

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
  /** A recorded procedure (F3-01) instead of a BPMN, and the teacher's values for it. */
  let procedure: { values: Record<string, string> } | null = null;
  let plan: BpmnPlan | null = null;
  let slots: ProcessSlots = {};
  let table: FormTable | null = null;
  let overviewShown = false;
  /** F3·03: the photo waiting in the inbox when the steps show, and its thumbnail. */
  let waitingPhoto: { thumbnail: string | null } | null = null;
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
    // F3·06: say or type the number, or leave it for later (the BPMN's "belum dinilai").
    const rest = [{ id: OTHER_NUMBER, label: "Ucapkan atau ketik angkanya" }];
    if (options.length < 2) rest.push({ id: LEAVE_EMPTY, label: "Kosongkan dulu" });
    return [...options, ...rest].slice(0, 3) as [NemuChoice, NemuChoice];
  }

  /** "Potongan foto · Citra, Tajwid": which cell the crop is. */
  function cropCaption(question: FormPhotoQuestion): string {
    if (question.kind === "name") return `Potongan foto · ${question.rowName}`;
    const firstName = question.rowName.split(/\s+/u)[0] ?? question.rowName;
    return `Potongan foto · ${firstName}, ${question.label}`;
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
        // F3·03: the steps as a start card; Mulai is the teacher's go-ahead, Nanti lets it go.
        if (runnable && plan)
          return {
            type: "pilih",
            layout: "row",
            status: { text: "Dari alur sekolah", count: processName },
            question: overviewQuestion(),
            image: waitingPhoto?.thumbnail
              ? { src: waitingPhoto.thumbnail, alt: "Foto dari WhatsApp" }
              : undefined,
            steps: plan.overview,
            link: { label: "Sumber", onSelect: () => openSource() },
            choices: [
              { id: "nanti", label: "Nanti" },
              { id: "mulai", label: "Mulai" },
            ],
            onChoose: (id) => (id === "mulai" ? void begin() : close()),
          };
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
          detail: afterLine(plan?.announcements ?? []),
          items,
          onClose: () => reset(),
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
        // Only the crop reaches the page, never the whole photo, so there is no "Lihat foto utuh".
        return {
          type: "pilih",
          status: { text: "Memeriksa foto", count: `${index + 1} dari ${questions.length}` },
          question: question.prompt,
          detail: phase.misheard ? "Nemu belum menangkap jawabannya." : undefined,
          choices: questionChoices(question) as unknown as readonly [NemuChoice, NemuChoice],
          onChoose: (id) => choose(index, id),
          image: crop
            ? { src: crop, alt: `Foto, baris ${question.rowName}`, caption: cropCaption(question) }
            : undefined,
        };
      }
      case "number": {
        const index = phase.index;
        const question = questions[index];
        const what =
          question?.kind === "value" ? `${question.label} ${question.rowName}` : "nilainya";
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

  /** "Mulai dari foto ini, Ibu?": the photo already in the inbox is what Nemu starts from. */
  function overviewQuestion(): string {
    return waitingPhoto ? `Mulai dari foto ini, ${address()}?` : `Mulai sekarang, ${address()}?`;
  }

  /** Sumber: the uploaded BPMN, drawn in the Admin Workspace with this run's path marked. */
  function openSource() {
    const url = new URL("/process-diagram", adminUrl());
    url.searchParams.set("document", documentId);
    if (plan?.path.length) url.searchParams.set("path", plan.path.join(","));
    window.open(url.href, "_blank", "noopener");
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
    if (process.kind === "procedure") {
      procedure = { values: {} };
      return replay();
    }
    await planWith(utterance, null);
  }

  /** F3-01: the recorded steps, asking for each value they need, then the executor. */
  async function replay() {
    if (!procedure) return;
    const run = generation;
    const response = await call({ op: "run-procedure", documentId, values: procedure.values });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message, () => void replay());
    const result = response.value as ProcessRunValue["run-procedure"];
    if (result.status === "missing") {
      const { name, question } = result.parameter;
      return setPhase({ name: "asking", question, slot: name }, question);
    }
    setPhase({ name: "running" });
    await executor.start(
      procedureTask({
        title: result.title,
        recordedBy: result.recordedBy,
        steps: result.steps,
        honorific: context.honorific,
      }),
    );
    reset();
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
    const forTeacherTask =
      step.kind === "ask" && next.tasks.some((task) => task.taskId === step.taskId);
    // What kind of process this is (a start form, a branch) is asked before the steps are shown.
    if (step.kind === "ask" && !forTeacherTask)
      return setPhase({ name: "asking", question: step.question, slot: step.slot }, step.question);
    if (!overviewShown) {
      overviewShown = true;
      return void showOverview();
    }
    if (step.kind === "ask") {
      // A field the photo didn't have: asked one at a time, as typed or spoken words.
      if (jobId)
        return setPhase(
          { name: "asking", question: step.question, slot: step.slot },
          step.question,
        );
      return void needData(step.question, step.slot);
    }
    void execute();
  }

  /**
   * F3·03: the steps, with the photo already in the inbox as a thumbnail. Only the thumbnail is
   * fetched here; the photo is read after Mulai.
   */
  async function showOverview() {
    const run = generation;
    const response = canRun(plan ?? { tasks: [] }) ? await call({ op: "jobs" }) : null;
    if (run !== generation) return;
    const waiting = response?.ok
      ? (response.value as InboxJob[]).find((job) => job.status === "queued")
      : undefined;
    waitingPhoto = waiting ? { thumbnail: null } : null;
    const runnable = !!plan && canRun(plan);
    setPhase(
      { name: "overview" },
      runnable ? overviewQuestion() : `Ini langkah ${processName}, ${address()}.`,
    );
    if (!waiting) return;
    const thumbnail = await call({ op: "thumbnail", jobId: waiting.jobId });
    if (run !== generation || !waitingPhoto) return;
    waitingPhoto = { thumbnail: thumbnail.ok ? (thumbnail.value as string | null) : null };
    publish();
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
    const header = built.continuation.header;
    kept = {
      jobId,
      announcements: plan.announcements,
      processName,
      check: {
        rows: built.continuation.rows?.rows ?? [],
        className: header.find((field) => /^kelas$/iu.test(field.label))?.value ?? null,
        date: header.find((field) => /^\d{4}-\d{2}-\d{2}$/u.test(field.value))?.value ?? null,
        recipe: plan.overview,
      },
    };
    void call({ op: "state-save", state: kept });
    setPhase({ name: "running" });
    await executor.start(built.task, { continuation: built.continuation });
  }

  /**
   * The run ended: name what others do next (F3-18), let the photo go, and show Catatan langkah.
   * Once she saved, Nemu reads the rows back from AlurSekolah (F3·08): "Sudah dicek" with the
   * steps as a recipe, or what differs.
   */
  function afterRun(ended: RunState, notes: string[], show: boolean) {
    void (async () => {
      kept ??= await loadKept();
      const items = [...notes];
      let photo: string | null = null;
      if (ended.status === "done" && kept) {
        for (const next of kept.announcements) items.push(`Selanjutnya, ${next}`);
        if (kept.jobId) {
          const acked = await call({ op: "ack", jobId: kept.jobId });
          photo = acked.ok ? "Foto dihapus dari Nemu" : "Foto belum terhapus";
          items.push(photo);
        }
      }
      const check = ended.status === "done" ? kept?.check : undefined;
      const checked = check?.rows.length ? await readBack(check) : null;
      void call({ op: "state-save", state: null });
      const after = afterLine(kept?.announcements ?? []);
      const name = kept?.processName ?? processName;
      reset();
      const offer = ended.startCara === 1 ? ended.task.kind : null;
      if (!checked || !check) return executor.presentNotes(items, offer, show);
      const detail = [checkedDetail(checked) ?? after, photo && `${photo}.`]
        .filter(Boolean)
        .join(" ");
      const card: NotesCard = recipeCard({
        checked: { ok: isSame(checked), title: checkedTitle(checked) },
        detail,
        recipe: name,
      });
      executor.presentNotes(check.recipe, offer, show, card);
    })();
  }

  /** Reads the saved rows back until the save shows (she confirms after her press), or gives up. */
  async function readBack(check: NonNullable<Kept["check"]>): Promise<ProcessReadback | null> {
    const run = generation;
    setPhase({ name: "working", sentence: "Nemu mencocokkan yang tersimpan dengan buku…" });
    let last: ProcessReadback | null = null;
    for (let tries = 0; tries < READBACK_TRIES; tries += 1) {
      const response = await call({
        op: "readback",
        rows: check.rows,
        className: check.className,
        date: check.date,
      });
      if (run !== generation || !response.ok) return null;
      last = response.value as ProcessReadback | null;
      if (!last || last.missing.length < last.total) return last;
      await new Promise((resolve) => setTimeout(resolve, READBACK_MS));
      if (run !== generation) return null;
    }
    return last;
  }

  function isSame(result: ProcessReadback): boolean {
    return result.total > 0 && result.matched === result.total;
  }

  /** "Setoran 3 murid tersimpan, sama dengan buku." */
  function checkedTitle(result: ProcessReadback): string {
    if (isSame(result)) return `Setoran ${result.total} murid tersimpan, sama dengan buku.`;
    if (result.missing.length === result.total) return "Setoran belum tersimpan di AlurSekolah.";
    const off = result.total - result.matched;
    return `Setoran tersimpan, tapi ${off} dari ${result.total} murid belum sama dengan buku.`;
  }

  /** Who differs and in which cell, when something does. */
  function checkedDetail(result: ProcessReadback): string | undefined {
    if (isSame(result)) return undefined;
    const parts = [...result.different, ...result.missing.map((name) => `${name} belum tersimpan`)];
    return parts.length ? `${parts.join("; ")}.` : undefined;
  }

  async function loadKept(): Promise<Kept | null> {
    const response = await call({ op: "state-load" });
    return response.ok ? ((response.value as Kept | null) ?? null) : null;
  }

  function reset() {
    generation += 1;
    stopPolling();
    documentId = "";
    procedure = null;
    plan = null;
    slots = {};
    table = null;
    overviewShown = false;
    waitingPhoto = null;
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
          if (procedure) {
            procedure.values = { ...procedure.values, [phase.slot]: text.trim() };
            // Until the next question shows, words aren't an answer to this one.
            setPhase({ name: "working", sentence: "Nemu menyiapkan langkahnya…" });
            void replay();
            return true;
          }
          void planWith(text, phase.slot);
          return true;
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
