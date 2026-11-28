import { cleanRecording } from "@nemu/ai/school/procedures";
import type { NarrationSegment, RecordedEvent } from "@nemu/contracts/school";
import type { NemuDisplay, NemuStatus } from "@nemu/ui/lib/nemu-display";

import { adminUrl } from "../../../shared/lib/config";
import type { PageEmail } from "../../../shared/lib/messages";
import { requestRecorder } from "../api/request-recorder";
import { captureEvents } from "../lib/capture";
import type { RecorderValue } from "../lib/requests";

/**
 * F3-01 "Rekam cara" (#214): the operator does the task once on the page while Nemu records the
 * locators and, while the talk combination is held, what they say (on the same clock). Jeda
 * pauses both until Lanjut. Selesai hands the recording to the Nemu Service; the operator
 * reviews, renames and saves it in the Admin Workspace, where they are signed in. Nothing is
 * compiled or saved from the page.
 */

/** The recording bubble and the pill on the page while Nemu records. */
export type RecordingDisplay = {
  status: NemuStatus;
  sentence: string;
  detail: string;
  /** Jeda: nothing done on the page or said is recorded until Lanjut. */
  paused: boolean;
  /** Steps recorded so far, numbered as the review will number them. */
  steps: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
};

export type RecorderView = { display: NemuDisplay | null; recording: RecordingDisplay | null };

type Recording = {
  title: string;
  startedAt: number;
  events: RecordedEvent[];
  narration: NarrationSegment[];
  /** Kept with the recording, so a page load during Jeda doesn't start recording again. */
  paused?: boolean;
};

type Phase =
  | { name: "idle" }
  | { name: "recording" }
  | { name: "saving" }
  | { name: "saved"; recordingId: string; steps: number }
  | { name: "notice"; sentence: string; retry?: () => void };

type Context = {
  pageEmail: PageEmail;
  honorific: string;
  /** The signed-in operator's name as the Nemu Service has it: "Rizal", "Siti Aminah, S.Pd.". */
  name?: string;
  /** The school's talk combination as written on screen: "Ctrl + Spasi". */
  talkKeys?: string;
  speak: (text: string) => void;
};

const DEFAULT_TITLE = "Cara baru";

/** "Siti Aminah, S.Pd." → "Siti": the name on the right of the recording bubble's heading. */
export function firstName(name: string | undefined): string | undefined {
  return name?.trim().split(/[\s,]+/u)[0] || undefined;
}

function createRecorder() {
  const listeners = new Set<() => void>();
  let context: Context = { pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} };
  let view: RecorderView = { display: null, recording: null };
  let phase: Phase = { name: "idle" };
  let recording: Recording | null = null;
  let stopCapture: (() => void) | null = null;
  let talkStartedAt: number | null = null;

  const call = <R extends Parameters<typeof requestRecorder>[1]>(request: R) =>
    requestRecorder(context.pageEmail, request);
  const address = () =>
    context.honorific === "Bu" ? "Ibu" : context.honorific === "Pak" ? "Bapak" : "Anda";

  function stepCount(): number {
    return recording ? cleanRecording(recording.events).length : 0;
  }

  /** While recording: the latest explanation in quotes, or what to do before there is one. */
  function recordingDisplay(): RecordingDisplay | null {
    if (phase.name !== "recording" || !recording) return null;
    const paused = recording.paused ?? false;
    const said = recording.narration.at(-1)?.text;
    const operator = firstName(context.name);
    let sentence = `Nemu merekam “${recording.title}”.`;
    let detail = `Klik dan isian ikut tercatat. Tahan ${context.talkKeys ?? "Ctrl + Spasi"} untuk menjelaskan.`;
    if (paused) {
      sentence = "Rekaman dijeda.";
      detail = "Klik dan isian tidak tercatat sampai Lanjut.";
    } else if (said) {
      sentence = `“${said}”`;
      detail = "Klik dan isian ikut tercatat.";
    }
    return {
      status: paused
        ? { tone: "muted", text: "Dijeda", count: operator }
        : { tone: "nemu", text: "Merekam", count: operator },
      sentence,
      detail,
      paused,
      steps: stepCount(),
      onPause: pause,
      onResume: resume,
      onFinish: () => void finish(),
    };
  }

  function displayFor(): NemuDisplay | null {
    switch (phase.name) {
      case "idle":
      case "recording":
        return null;
      case "saving":
        return {
          type: "kerja",
          sentence: "Nemu menyimpan rekamannya…",
          status: { tone: "working", text: "Menyimpan" },
          onSlow: () => undefined,
          onStop: () => undefined,
        };
      case "saved": {
        const { recordingId } = phase;
        return {
          type: "jawab",
          sentence: `Rekaman tersimpan: ${phase.steps} langkah. Periksa dan simpan di Admin Workspace.`,
          status: { tone: "saved", text: "Terekam" },
          action: {
            label: "Periksa rekaman",
            onSelect: () => {
              window.open(
                `${adminUrl().replace(/\/$/u, "")}/recording?recording=${encodeURIComponent(recordingId)}`,
                "_blank",
                "noopener",
              );
              reset();
            },
          },
          onClose: () => reset(),
        };
      }
      case "notice":
        return {
          type: "jawab",
          sentence: phase.sentence,
          action: phase.retry ? { label: "Coba lagi", onSelect: phase.retry } : undefined,
          onClose: () => reset(),
        };
    }
  }

  function publish() {
    view = { display: displayFor(), recording: recordingDisplay() };
    for (const listener of listeners) listener();
  }

  function setPhase(next: Phase, spoken?: string) {
    phase = next;
    publish();
    if (spoken) context.speak(spoken);
  }

  function keep() {
    void call({ op: "state-save", state: phase.name === "recording" ? recording : null });
  }

  function listen() {
    stopCapture?.();
    if (!recording) return;
    stopCapture = captureEvents(document, recording.startedAt, (event) => {
      recording?.events.push(event);
      keep();
      publish();
    });
  }

  function start(title: string) {
    reset();
    recording = {
      title: title.trim() || DEFAULT_TITLE,
      startedAt: Date.now(),
      events: [],
      narration: [],
    };
    setPhase({ name: "recording" }, `Nemu mulai merekam, ${address()}.`);
    listen();
    keep();
  }

  /** Jeda: stop listening to the page and to the talk combination until Lanjut. */
  function pause() {
    if (phase.name !== "recording" || !recording || recording.paused) return;
    stopCapture?.();
    stopCapture = null;
    talkStartedAt = null;
    recording.paused = true;
    keep();
    publish();
  }

  /** Lanjut: record again on the same clock, so the steps carry on from where they stopped. */
  function resume() {
    if (phase.name !== "recording" || !recording?.paused) return;
    recording.paused = false;
    listen();
    keep();
    publish();
  }

  async function finish() {
    if (!recording) return;
    stopCapture?.();
    stopCapture = null;
    if (!recording.events.length) {
      void call({ op: "state-save", state: null });
      return setPhase({ name: "notice", sentence: "Belum ada langkah yang terekam." });
    }
    const current = recording;
    setPhase({ name: "saving" });
    const response = await call({
      op: "save",
      title: current.title,
      events: current.events,
      narration: current.narration,
    });
    if (!response.ok)
      return setPhase(
        { name: "notice", sentence: response.message, retry: () => void finish() },
        response.message,
      );
    const saved = response.value as RecorderValue["save"];
    const steps = cleanRecording(current.events).length;
    recording = null;
    void call({ op: "state-save", state: null });
    setPhase(
      { name: "saved", recordingId: saved.recordingId, steps },
      `Rekaman tersimpan: ${steps} langkah.`,
    );
  }

  function reset() {
    stopCapture?.();
    stopCapture = null;
    recording = null;
    talkStartedAt = null;
    setPhase({ name: "idle" });
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,
    connect(next: Context) {
      context = next;
      publish();
    },
    start,
    finish,
    pause,
    resume,

    /** The talk combination went down: narration starts now, on the recording's clock. */
    talkStarted() {
      if (phase.name === "recording" && !recording?.paused) talkStartedAt = Date.now();
    },

    /**
     * What the operator said while recording becomes narration, not a question. During Jeda the
     * words are let go: neither recorded nor asked.
     */
    narrate(text: string): boolean {
      if (phase.name !== "recording" || !recording) return false;
      if (recording.paused) {
        talkStartedAt = null;
        return true;
      }
      const end = Date.now() - recording.startedAt;
      const start = talkStartedAt === null ? end : talkStartedAt - recording.startedAt;
      talkStartedAt = null;
      if (text.trim())
        recording.narration.push({ start: Math.max(0, start), end, text: text.trim() });
      keep();
      publish();
      return true;
    },

    /** After a page load: carry on recording if Nemu was (F0-13), still paused after Jeda. */
    async restore() {
      const response = await call({ op: "state-load" });
      const saved = response.ok ? (response.value as Recording | null) : null;
      if (!saved) return;
      recording = saved;
      setPhase({ name: "recording" });
      if (!saved.paused) listen();
    },

    /** For tests and the review link: what was captured so far. */
    snapshot: () => recording,
  };
}

/** The page's one recorder (#214). */
export const recorder = createRecorder();
