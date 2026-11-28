import type {
  GradeEntry,
  InboxJob,
  PhotoTitleCandidate,
  VerificationAnswer,
  VerificationQuestion,
} from "@nemu/contracts/school";
import type { KartuPilihProps, NemuDisplay } from "@nemu/ui/lib/nemu-display";

import type { PageEmail } from "../../../shared/lib/messages";
import type { RunState } from "../../executor/lib/run";
import { executor } from "../../executor/stores/executor";
import { requestGradePhoto } from "../api/request-grade-photo";
import {
  questionChoices,
  type QuestionReply,
  replyFromChoice,
  replyFromNumber,
  replyFromSpeech,
} from "../lib/answers";
import { addressFor, GRADE_TASK_KIND, type GradeTarget, gradeTask } from "../lib/grade-task";
import { gradeGuide } from "../lib/guided-lines";
import type { GradePhotoRequest, GradePhotoValue } from "../lib/requests";
import { gradesOnPage, watchForSave } from "../lib/saved-page";

/**
 * F1 (#207), from the WhatsApp photo to the read-back: the card in one visible tab, "Ini nilai
 * apa, Bu?" with the photo's title as the choices (#270) or the command ("masukkan nilai UTS
 * Matematika 4B"), the read (≤ 60 s), W5's questions one per card, the
 * rules, the cara 1 fill by the executor, and after the teacher presses Simpan the read-back,
 * `inboxAck` and Catatan langkah. What must survive a page load (the fill and the wait for the
 * save) is kept per tab in the background.
 */

/** PRD F1-01: the visible tab polls every 3–5 s. */
export const POLL_MS = 4000;
/** `inboxProcess` answers at once while another call is still reading; ask again until done. */
const PROCESS_RETRY_MS = 3000;
const PROCESS_TRIES = 40;

export type GradePhotoView = {
  /** The one display of the flow, above the Nemu button. */
  display: NemuDisplay | null;
  /** The small "Foto dari WhatsApp" card, shown when nothing else is. */
  card: NemuDisplay | null;
  /** The type box goes under the display: Nemu waits for a typed or spoken answer. */
  typing: boolean;
};

type Phase =
  | { name: "idle" }
  | { name: "notice"; sentence: string; retry?: () => void }
  | { name: "title" }
  | { name: "picking"; candidates: PhotoTitleCandidate[] }
  | { name: "command"; question: string }
  | { name: "reading" }
  | { name: "verifying"; index: number; misheard?: boolean }
  | { name: "number"; index: number; misheard?: boolean }
  | { name: "finalizing" }
  | { name: "filling" }
  | { name: "saving" }
  | { name: "reading-back" }
  | { name: "done"; sentence: string; match: boolean; ringkasan: string | null };

/** What is kept in the background for this tab while the fill and the save are under way. */
type Kept = {
  phase: "filling" | "saving";
  jobId: string;
  target: GradeTarget;
  entries: GradeEntry[];
  questions: number;
  notes: string[];
  offer: string | null;
};

type Context = {
  pageEmail: PageEmail;
  honorific: string;
  registered: boolean;
  speak: (text: string) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "Bu menjawab 10 pertanyaan tentang foto" goes after the Sumber line, before the fill. */
function withAnswered(notes: readonly string[], answered: string): string[] {
  const source = notes[0]?.startsWith("Sumber:") ? 1 : 0;
  return [...notes.slice(0, source), answered, ...notes.slice(source)];
}

/** The choice for a title the photo shows: "UTS · Matematika · 4B". */
function titleLabel(candidate: PhotoTitleCandidate) {
  return [candidate.assessment, candidate.subject, candidate.className].filter(Boolean).join(" · ");
}

/** The same title as the words she would say, for the command parser: "UTS Matematika 4B". */
function titleWords(candidate: PhotoTitleCandidate) {
  return [candidate.assessment, candidate.subject, candidate.className].filter(Boolean).join(" ");
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createGradePhoto() {
  const listeners = new Set<() => void>();
  let context: Context = {
    pageEmail: { kind: "unreadable" },
    honorific: "",
    registered: false,
    speak: () => undefined,
  };
  let view: GradePhotoView = { display: null, card: null, typing: false };
  let phase: Phase = { name: "idle" };
  /** Photos this tab may offer (claimed for it), and those the teacher put off with Nanti. */
  let jobs: InboxJob[] = [];
  const dismissed = new Set<string>();
  /** What the teacher asked for, and the words so far while Nemu asks for the rest. */
  let target: GradeTarget | null = null;
  /** 2 when she asked to be taught ("Ajari saya ngisi nilai"): the fill starts in cara 2 (F1-11). */
  let cara: 2 | undefined;
  let utterance = "";
  let job: InboxJob | null = null;
  let answers: VerificationAnswer[] = [];
  let crops: (string | null)[] = [];
  let kept: Kept | null = null;
  let stopWatching: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  /** Bumped by every cancel, so a reply that comes back after it is dropped. */
  let generation = 0;

  const address = () => addressFor(context.honorific);

  function call<R extends GradePhotoRequest>(request: R) {
    return requestGradePhoto(context.pageEmail, request);
  }

  function questions(): VerificationQuestion[] {
    return job?.verification?.questions ?? [];
  }

  // --- What the page shows ----------------------------------------------------------------------

  function cardFor(): NemuDisplay | null {
    const offered = jobs.find(
      (candidate) => !dismissed.has(candidate.jobId) && candidate.jobId !== job?.jobId,
    );
    if (!offered || (phase.name !== "idle" && phase.name !== "notice")) return null;
    return {
      type: "pilih",
      compact: true,
      question: "Foto dari WhatsApp",
      choices: [
        { id: "mulai", label: "Mulai" },
        { id: "nanti", label: "Nanti" },
      ],
      onChoose: (id) => {
        if (id === "mulai") void start(offered);
        else {
          dismissed.add(offered.jobId);
          publish();
        }
      },
    };
  }

  function displayFor(): NemuDisplay | null {
    const close = () => cancel();
    switch (phase.name) {
      case "idle":
      case "filling":
        return null;
      case "notice":
        return {
          type: "jawab",
          sentence: phase.sentence,
          action: phase.retry ? { label: "Coba lagi", onSelect: phase.retry } : undefined,
          onClose: close,
        };
      case "title":
        return {
          type: "kerja",
          sentence: "Nemu membaca judul foto…",
          status: { tone: "working", text: "Nemu membaca foto" },
          onSlow: () => undefined,
          onStop: close,
        };
      case "picking": {
        const candidates = phase.candidates;
        const other = { id: "lain", label: "Nilai lain" };
        const [first, second] = candidates.map((candidate, index) => ({
          id: String(index),
          label: titleLabel(candidate),
        }));
        const choices: KartuPilihProps["choices"] = second
          ? [first!, second, other]
          : [first!, other];
        return {
          type: "pilih",
          question: pickQuestion(),
          choices,
          onChoose: (id) => {
            const picked = candidates[Number(id)];
            if (id === other.id || !picked) askCommand();
            else void command(titleWords(picked));
          },
        };
      }
      case "command":
        return { type: "jawab", sentence: phase.question, onClose: close };
      case "reading":
        return {
          type: "kerja",
          sentence: "Nemu membaca foto buku nilai…",
          status: { tone: "working", text: "Nemu membaca foto" },
          onSlow: () => undefined,
          onStop: close,
        };
      case "verifying": {
        const index = phase.index;
        const question = questions()[index];
        if (!question) return null;
        const crop = crops[index];
        const total = questions().length;
        const accepted = job?.verification?.acceptedSentence ?? "";
        return {
          type: "pilih",
          question: phase.misheard ? `Nemu belum menangkap. ${question.prompt}` : question.prompt,
          choices: questionChoices(question),
          onChoose: (id) => answer(index, replyFromChoice(id)),
          image: crop ? { src: crop, alt: `Foto buku nilai, baris ${question.line}` } : undefined,
          note: `Pertanyaan ${index + 1} dari ${total}. ${accepted}`.trim(),
        };
      }
      case "number": {
        const index = phase.index;
        const question = questions()[index];
        const who = question && "studentName" in question ? question.studentName : "siswa ini";
        return {
          type: "jawab",
          sentence: phase.misheard
            ? `Nemu belum menangkap angkanya. Berapa nilai ${who}?`
            : `Berapa nilai ${who}, ${address()}? Ketik atau sebutkan angkanya.`,
          onClose: () => setPhase({ name: "verifying", index }),
        };
      }
      case "finalizing":
        return {
          type: "kerja",
          sentence: "Nemu menerapkan aturan sekolah…",
          status: { tone: "working", text: "Nemu menghitung" },
          onSlow: () => undefined,
          onStop: close,
        };
      case "saving":
        return {
          type: "jawab",
          sentence: "Nemu menunggu nilainya tersimpan, lalu membaca ulang.",
          status: { tone: "unsaved", text: "Belum tersimpan" },
          action: { label: "Sudah tersimpan", onSelect: () => void readBack() },
          onClose: () => finishWithoutReadback(),
        };
      case "reading-back":
        return {
          type: "kerja",
          sentence: "Nemu membaca ulang nilai yang tersimpan…",
          status: { tone: "working", text: "Nemu memeriksa" },
          onSlow: () => undefined,
          onStop: () => finishWithoutReadback(),
        };
      case "done":
        return {
          type: "jawab",
          sentence: phase.sentence,
          status: phase.match
            ? { tone: "saved", text: "Tersimpan" }
            : { tone: "unsaved", text: "Belum sesuai" },
          notes: phase.ringkasan ? { ringkasan: phase.ringkasan } : undefined,
          action: { label: "Catatan langkah", onSelect: () => showNotes(true) },
          onClose: () => showNotes(false),
        };
    }
  }

  function publish() {
    view = {
      display: displayFor(),
      card: cardFor(),
      typing: ["picking", "command", "number"].includes(phase.name),
    };
    for (const listener of listeners) listener();
  }

  /** Moves on and says the new display's words, as Nemu does with every answer. */
  function setPhase(next: Phase, spoken?: string) {
    phase = next;
    publish();
    if (spoken) context.speak(spoken);
  }

  function notice(sentence: string, retry?: () => void) {
    setPhase({ name: "notice", sentence, retry }, sentence);
  }

  // --- The inbox --------------------------------------------------------------------------------

  async function poll() {
    if (!context.registered || document.visibilityState !== "visible") return;
    if (phase.name !== "idle" && phase.name !== "notice" && phase.name !== "command") return;
    const response = await call({ op: "poll" });
    if (!response.ok) return;
    const next = response.value as GradePhotoValue["poll"];
    const changed =
      next.length !== jobs.length || next.some((item, at) => item.jobId !== jobs[at]?.jobId);
    jobs = next;
    if (changed) publish();
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => void poll(), POLL_MS);
    void poll();
  }

  // --- The flow ---------------------------------------------------------------------------------

  function pickQuestion() {
    return `Ini nilai apa, ${context.honorific || address()}?`;
  }

  async function start(offered: InboxJob) {
    job = offered;
    answers = [];
    crops = [];
    void call({ op: "hold", jobId: offered.jobId });
    if (target) return process();
    utterance = "";
    // #270: the photo's title gives the choices; a title Nemu can't read falls back to asking.
    const run = generation;
    setPhase({ name: "title" });
    const response = await call({ op: "title", jobId: offered.jobId });
    if (run !== generation) return;
    const candidates = response.ok
      ? (response.value as GradePhotoValue["title"]).candidates.slice(0, 2)
      : [];
    if (candidates.length === 0) return askCommand();
    setPhase({ name: "picking", candidates }, pickQuestion());
  }

  /** "Nilai apa ini, Ibu?": she says or types what the grades are. */
  function askCommand() {
    utterance = "";
    const question = `Foto buku nilai sudah masuk. Nilai apa ini, ${address()}? Misalnya “UTS Matematika 4B”.`;
    setPhase({ name: "command", question }, question);
  }

  /**
   * "masukkan nilai UTS Matematika 4B", typed, spoken, picked from the photo's title, or the answer
   * to Nemu's question.
   */
  async function command(words: string) {
    if (!["idle", "notice", "picking", "command"].includes(phase.name)) return;
    const asked = phase.name === "command";
    utterance = asked ? `${utterance} ${words}`.trim() : words;
    const run = generation;
    const response = await call({ op: "command", utterance });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message);
    const result = response.value as GradePhotoValue["command"];
    if (result.status === "ask")
      return setPhase({ name: "command", question: result.question }, result.question);
    target = {
      className: result.className,
      subject: result.subject,
      assessment: result.assessment,
    };
    cara = result.cara;
    if (job) return process();
    const waiting = jobs.find((candidate) => !dismissed.has(candidate.jobId));
    if (waiting) return start(waiting);
    notice(
      `Kirim foto buku nilai ${target.assessment} ${target.subject} ${target.className} ke WhatsApp Nemu, ${address()}. Nemu menunggu di sini.`,
    );
  }

  async function process(): Promise<void> {
    if (!job || !target) return;
    const run = generation;
    const current = job;
    setPhase({ name: "reading" });
    for (let tries = 0; tries < PROCESS_TRIES; tries += 1) {
      const response = await call({
        op: "process",
        jobId: current.jobId,
        className: target.className,
        assessment: target.assessment,
      });
      if (run !== generation) return;
      if (!response.ok) return notice(response.message, () => void process());
      const read = response.value as GradePhotoValue["process"];
      job = read;
      if (read.status === "processing" || read.status === "queued") {
        await sleep(PROCESS_RETRY_MS);
        if (run !== generation) return;
        continue;
      }
      if (read.status === "reshoot") {
        // The photo can't be read: it goes, and the next one the teacher sends is offered.
        void call({ op: "ack", jobId: read.jobId });
        jobs = jobs.filter((item) => item.jobId !== read.jobId);
        job = null;
        return notice(read.message ?? "Fotonya belum terbaca jelas. Kirim ulang, ya.");
      }
      if (read.status === "failed")
        return notice(
          read.message ?? "Foto belum bisa dibaca sekarang. Coba lagi sebentar, ya.",
          () => void process(),
        );
      return verify();
    }
    notice("Nemu belum selesai membaca fotonya. Coba lagi sebentar, ya.", () => void process());
  }

  async function verify() {
    const list = questions();
    if (list.length === 0) return finalize();
    const run = generation;
    const response = await call({
      op: "crops",
      jobId: job!.jobId,
      boxes: list.map((question) => question.box),
    });
    if (run !== generation) return;
    crops = response.ok ? (response.value as GradePhotoValue["crops"]) : [];
    ask(0);
  }

  function ask(index: number, misheard = false) {
    const question = questions()[index];
    if (!question) return;
    setPhase(
      { name: "verifying", index, misheard },
      misheard ? `Nemu belum menangkap. ${question.prompt}` : question.prompt,
    );
  }

  function answer(index: number, reply: QuestionReply) {
    const question = questions()[index];
    if (!question) return;
    if ("other" in reply) {
      // A name has no number to type: "Angka lain" there means it isn't on the list.
      if (question.kind === "name") return answer(index, { answer: "none" });
      return setPhase(
        { name: "number", index },
        `Berapa nilai ${question.studentName}, ${address()}?`,
      );
    }
    answers = [
      ...answers.filter((item) => item.questionId !== question.id),
      { questionId: question.id, answer: reply.answer },
    ];
    if (index + 1 < questions().length) return ask(index + 1);
    void finalize();
  }

  async function finalize() {
    if (!job?.reading || !target) return;
    const run = generation;
    setPhase({ name: "finalizing" });
    const response = await call({ op: "finalize", reading: job.reading, answers });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message, () => void finalize());
    const result = response.value as GradePhotoValue["finalize"];
    if (result.status !== "ok") return notice(result.sentence);
    const task = gradeTask({
      command: target,
      entries: result.entries,
      summarySentence: result.summarySentence,
      honorific: context.honorific,
    });
    kept = {
      phase: "filling",
      jobId: job.jobId,
      target,
      entries: result.entries,
      questions: questions().length,
      notes: [],
      offer: null,
    };
    void call({ op: "state-save", state: kept });
    setPhase({ name: "filling" });
    void executor.start(task, cara ? { cara } : {});
  }

  /** The executor's run ended: after Simpan wait for the save; after Berhenti let the photo be. */
  function afterFill(ended: RunState, notes: string[], show: boolean) {
    void (async () => {
      kept ??= await loadKept();
      if (!kept || ended.status !== "done") {
        if (kept) void call({ op: "release", jobId: kept.jobId });
        void call({ op: "state-save", state: null });
        reset();
        executor.presentNotes(notes, null, show);
        return;
      }
      const teacher = capitalize(context.honorific || "Anda");
      kept = {
        ...kept,
        phase: "saving",
        notes: withAnswered(notes, `${teacher} menjawab ${kept.questions} pertanyaan tentang foto`),
        offer: ended.startCara === 1 ? ended.task.kind : null,
      };
      void call({ op: "state-save", state: kept });
      waitForSave(false);
    })();
  }

  function waitForSave(acceptPresent: boolean) {
    setPhase({ name: "saving" });
    stopWatching?.();
    stopWatching = watchForSave(document, () => void readBack(), { acceptPresent });
  }

  /** F1-10: what AlurSekolah stored, compared with what the teacher checked; then the photo goes. */
  async function readBack() {
    if (!kept) return;
    stopWatching?.();
    stopWatching = null;
    const run = generation;
    const current = kept;
    setPhase({ name: "reading-back" });
    const response = await call({
      op: "readback",
      entries: current.entries,
      className: current.target.className,
      subject: current.target.subject,
      assessment: current.target.assessment,
      saved: gradesOnPage(document, current.entries),
    });
    if (run !== generation) return;
    if (!response.ok) return notice(response.message, () => void readBack());
    const result = response.value as GradePhotoValue["readback"];
    const acked = await call({ op: "ack", jobId: current.jobId });
    // The deleted photo is no longer offered, even before the next poll.
    jobs = jobs.filter((item) => item.jobId !== current.jobId);
    const where = result.source === "alursekolah" ? "dari AlurSekolah" : "di halaman";
    const checked = result.match
      ? `Nemu membaca ulang ${current.entries.length} nilai ${where}: semua sesuai`
      : `Nemu membaca ulang ${current.entries.length} nilai ${where}: ${result.mismatches.length} belum sesuai`;
    kept = {
      ...current,
      notes: [
        ...current.notes,
        checked,
        acked.ok ? "Foto buku nilai dihapus dari Nemu" : "Foto buku nilai belum terhapus",
      ],
    };
    void call({ op: "state-save", state: null });
    job = null;
    target = null;
    const ringkasan = result.mismatches.length
      ? result.mismatches
          .map(
            (item) => `${item.name}: tersimpan ${item.saved ?? "kosong"}, di buku ${item.expected}`,
          )
          .join("; ")
      : null;
    setPhase(
      { name: "done", sentence: result.sentence, match: result.match, ringkasan },
      result.sentence,
    );
  }

  /** The teacher closed the wait: Catatan langkah without a read-back; the photo stays for now. */
  function finishWithoutReadback() {
    stopWatching?.();
    stopWatching = null;
    if (kept) void call({ op: "release", jobId: kept.jobId });
    void call({ op: "state-save", state: null });
    showNotes(true);
  }

  function showNotes(show: boolean) {
    const notes = kept?.notes ?? [];
    const offer = kept?.offer ?? null;
    reset();
    executor.presentNotes(notes, offer, show);
  }

  function reset() {
    generation += 1;
    stopWatching?.();
    stopWatching = null;
    job = null;
    target = null;
    kept = null;
    answers = [];
    crops = [];
    utterance = "";
    setPhase({ name: "idle" });
  }

  /**
   * × or Berhenti. Before the fill nothing changed on the page, so the photo can be started again;
   * after it, Catatan langkah closes the task without a read-back.
   */
  function cancel() {
    if (kept && kept.phase === "saving") return finishWithoutReadback();
    if (job) void call({ op: "release", jobId: job.jobId });
    reset();
  }

  async function loadKept(): Promise<Kept | null> {
    const response = await call({ op: "state-load" });
    return response.ok ? ((response.value as Kept | null) ?? null) : null;
  }

  executor.registerFinisher(GRADE_TASK_KIND, afterFill);
  // Cara 2 ("Ajari saya", or the teacher taking over): Nemu says each grade from the book and
  // checks what she typed (F1-11). The grades come from the kept state, so this survives a reload.
  executor.registerGuide(
    GRADE_TASK_KIND,
    gradeGuide({
      entries: async () => (kept ??= await loadKept())?.entries ?? null,
      line: async (entries, studentId, typed) => {
        const response = await call({ op: "guided-line", entries, studentId, typed });
        return response.ok ? (response.value as GradePhotoValue["guided-line"]) : null;
      },
    }),
  );
  // Visible again: ask for photos now rather than at the next tick.
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", () => void poll());

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,

    /** Who Nemu works for on this page, and its voice. Polling runs while a teacher is known. */
    connect(next: Context) {
      const changed =
        JSON.stringify(next.pageEmail) !== JSON.stringify(context.pageEmail) ||
        next.registered !== context.registered;
      context = next;
      if (!changed) return;
      if (!next.registered) {
        clearInterval(pollTimer);
        jobs = [];
        cancel();
        return;
      }
      startPolling();
    },

    /** After a page load: carry on waiting for the save if Nemu was (F0-13). */
    async restore() {
      const saved = await loadKept();
      if (!saved) return;
      kept = saved;
      target = saved.target;
      job = null;
      if (saved.phase === "saving") waitForSave(true);
      else setPhase({ name: "filling" });
    },

    /** The panel's grade request ("masukkan nilai UTS Matematika 4B", helpRoute input_nilai). */
    command,

    /**
     * Words the teacher typed or said while Nemu waits for an answer. False when Nemu isn't
     * waiting, so the words go to the panel as a question instead.
     */
    hear(text: string): boolean {
      switch (phase.name) {
        case "picking":
        case "command":
          void command(text);
          return true;
        case "verifying": {
          const question = questions()[phase.index];
          const reply = question ? replyFromSpeech(question, text) : null;
          if (reply) answer(phase.index, reply);
          else ask(phase.index, true);
          return true;
        }
        case "number": {
          const reply = replyFromNumber(text);
          if (reply) answer(phase.index, reply);
          else {
            const index = phase.index;
            setPhase({ name: "number", index, misheard: true }, "Nemu belum menangkap angkanya.");
          }
          return true;
        }
        default:
          return false;
      }
    },

    cancel,
  };
}

/** The page's one F1 flow (#207). */
export const gradePhoto = createGradePhoto();
