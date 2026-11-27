import type { ActionLogEntry, UntrustedTask } from "@nemu/contracts/executor";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

import { siteConfigItem } from "../../../shared/lib/extension-storage";
import type { PageEmail } from "../../../shared/lib/messages";
import { voiceCommands } from "../../voice/stores/voice-commands";
import {
  requestLoadNotes,
  requestLoadRun,
  requestLogActions,
  requestSaveNotes,
  requestSaveRun,
  type StepNotes,
} from "../api/request-run-storage";
import { tryNextTime, wantsToTry } from "../api/teach-preference";
import { executorSettings } from "../lib/executor-settings";
import { createRunState, ExecutorRun, type RunState, type StepSource } from "../lib/run";
import type { Cara } from "../lib/run-notes";
import { guardSubmits, isTeacherInput, toSafeTask } from "../lib/safety";

/** What the page shows for the executor: one display, the element it points at, and the ticks. */
export type ExecutorView = {
  display: NemuDisplay | null;
  target: Element | null;
  ticks: Element[];
  /** A task is under way, so Nemu's panel stays closed. */
  active: boolean;
  /** Nemu is pointing and waiting for the teacher; `refused` when it was asked to press it. */
  waiting: { refused: boolean } | null;
  /** A Catatan langkah to reopen from the Nemu button. */
  hasNotes: boolean;
};

const IDLE: ExecutorView = {
  display: null,
  target: null,
  ticks: [],
  active: false,
  waiting: null,
  hasNotes: false,
};

/** The page's Nemu overlay host; input on it is Nemu's own bubble, not the page. */
const NEMU_HOST = "nemu-overlay";

const LOG_FLUSH_MS = 1000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * What a feature does once its task ends, before Catatan langkah: F1 reads the grades back after
 * the teacher saves (#207). It receives the notes so far and shows them itself with `presentNotes`.
 */
export type TaskFinisher = (ended: RunState, notes: string[], showNotes: boolean) => void;

function createExecutor() {
  const listeners = new Set<() => void>();
  const sources = new Map<string, StepSource>();
  const finishers = new Map<string, TaskFinisher>();
  let view: ExecutorView = IDLE;
  let run: ExecutorRun | null = null;
  let notes: StepNotes | null = null;
  let context: { pageEmail: PageEmail; honorific: string; speak: (text: string) => void } = {
    pageEmail: { kind: "unreadable" },
    honorific: "",
    speak: () => undefined,
  };
  let pendingLog: ActionLogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let detach: (() => void) | null = null;
  let settings = executorSettings(null);

  function publish(next: Partial<ExecutorView>) {
    view = {
      ...view,
      ...next,
      active: run?.isActive() ?? false,
      waiting: run?.waiting ?? null,
      hasNotes: notes !== null,
    };
    voiceCommands.setWorking(view.active);
    for (const listener of listeners) listener();
  }

  /** The action log (WS-10), sent in small batches; it never holds a value. */
  function queueLog(entry: Omit<ActionLogEntry, "website" | "at">) {
    pendingLog.push({ ...entry, website: location.host, at: Date.now() });
    if (pendingLog.length >= 50) flushLog();
    else flushTimer ??= setTimeout(flushLog, LOG_FLUSH_MS);
  }

  function flushLog() {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    if (pendingLog.length === 0) return;
    requestLogActions(context.pageEmail, pendingLog);
    pendingLog = [];
  }

  /** F0-07 and F0-08 while a task is under way: the teacher's input, and every submit. */
  function attachPageGuards(current: ExecutorRun) {
    const onInput = (event: Event) => {
      if (
        run === current &&
        isTeacherInput(event, document.querySelector(NEMU_HOST), settings.talkShortcut)
      )
        current.interrupt();
    };
    const types = ["mousedown", "keydown", "touchstart"] as const;
    for (const type of types) document.addEventListener(type, onInput, true);
    const unguard = guardSubmits(document, () => run === current && current.isActing());
    return () => {
      for (const type of types) document.removeEventListener(type, onInput, true);
      unguard();
    };
  }

  function showNotes(items: string[], offerToTry: string | null) {
    const close = () => publish({ display: null, target: null });
    publish({
      display: {
        type: "info",
        title: "Catatan langkah",
        items,
        link: offerToTry
          ? {
              label: "Lain kali coba sendiri",
              onSelect: () => {
                void tryNextTime(offerToTry);
                close();
              },
            }
          : undefined,
        onClose: close,
      },
      target: null,
      ticks: [],
    });
  }

  function begin(state: RunState) {
    detach?.();
    const current: ExecutorRun = new ExecutorRun(state, {
      doc: document,
      // Read when used: the identity may arrive after the task starts.
      get honorific() {
        return context.honorific;
      },
      fieldMs: 1000 / settings.fieldsPerSecond,
      permission: settings.permission,
      render: (next) => {
        if (run === current) publish(next);
      },
      speak: (text) => context.speak(text),
      sleep,
      log: (entry) =>
        queueLog({ ...entry, task: current.state.task.title, cara: current.state.cara }),
      save: (next) =>
        requestSaveRun(next.status === "done" || next.status === "stopped" ? null : next),
      source: sources.get(state.task.kind),
      onEnd: (ended, items, show) => {
        flushLog();
        detach?.();
        detach = null;
        notes = { title: "Catatan langkah", items };
        requestSaveNotes(notes);
        const finisher = finishers.get(ended.task.kind);
        if (finisher) {
          publish({ display: null, target: null, ticks: [] });
          return finisher(ended, items, show);
        }
        const offer = ended.startCara === 1 ? ended.task.kind : null;
        if (show) showNotes(items, offer);
        else publish({ display: null, target: null, ticks: [] });
      },
    });
    run = current;
    detach = attachPageGuards(current);
    return current;
  }

  function onVoice(event: Parameters<Parameters<typeof voiceCommands.subscribe>[0]>[0]) {
    if (!run?.isActive()) return;
    if (event.type === "pause") return run.pause();
    if (event.type === "resume") return run.resume();
    switch (event.command) {
      case "pelan":
        run.setSlow(true);
        return run.resume();
      case "ajari_saya":
        return run.teach();
      case "berhenti":
        return run.stop();
      case "lanjut":
      case "ulangi":
        return run.resume();
    }
  }
  voiceCommands.subscribe(onVoice);

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,

    /** Who Nemu works for on this page, and its voice. */
    connect(next: { pageEmail: PageEmail; honorific: string; speak: (text: string) => void }) {
      context = next;
    },

    /** A feature whose steps come in parts registers where the next ones come from (F0-09). */
    registerStepSource(kind: string, source: StepSource) {
      sources.set(kind, source);
    },

    /** A feature that finishes its own tasks after they end (`TaskFinisher`). */
    registerFinisher(kind: string, finisher: TaskFinisher) {
      finishers.set(kind, finisher);
    },

    /** A finisher's last word: Catatan langkah with its own lines added, kept for the Nemu button. */
    presentNotes(items: string[], offerToTry: string | null = null, show = true) {
      notes = { title: "Catatan langkah", items };
      requestSaveNotes(notes);
      if (show) showNotes(items, offerToTry);
      else publish({});
    },

    /**
     * Runs a task. Every task is checked first (`toSafeTask`): steps with verbs outside the
     * allowed six only point. Cara comes from WS-08's default unless the teacher chose "Lain kali
     * coba sendiri" for this kind of task, or the caller asks for one.
     */
    async start(untrusted: UntrustedTask, options: { cara?: Cara; continuation?: unknown } = {}) {
      run?.stop(false);
      settings = executorSettings(await siteConfigItem.getValue(), location.href);
      const { task, refused } = toSafeTask(untrusted);
      const cara = options.cara ?? ((await wantsToTry(task.kind)) ? 2 : settings.cara);
      const state = createRunState(task, { cara, refused, continuation: options.continuation });
      queueLog({ task: task.title, action: "start", target: "", cara, result: "done" });
      await begin(state).run();
    },

    /** After a page load: picks up the tab's run where it was (F0-13). */
    async restore() {
      const [state, saved] = await Promise.all([requestLoadRun(), requestLoadNotes()]);
      notes = saved;
      settings = executorSettings(await siteConfigItem.getValue(), location.href);
      if (state && state.status !== "done" && state.status !== "stopped") begin(state).restore();
      else publish({});
    },

    stop() {
      run?.stop();
    },

    /** Ends the task without Catatan langkah and closes whatever the executor shows. */
    clear() {
      run?.stop(false);
      publish({ display: null, target: null, ticks: [] });
    },

    /** Reopens the last Catatan langkah from the Nemu button (F0-14). */
    showNotes() {
      if (notes) showNotes(notes.items, null);
    },
  };
}

/** The page's one executor (#202). Every flow (F1, F3, F4, recordings) hands its tasks here. */
export const executor = createExecutor();
