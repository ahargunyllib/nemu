import { cleanRecording } from "@nemu/ai/school/procedures";
import type { NarrationSegment, RecordedEvent } from "@nemu/contracts/school";
import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";

import { adminUrl } from "../../../shared/lib/config";
import type { PageEmail } from "../../../shared/lib/messages";
import { requestRecorder } from "../api/request-recorder";
import { captureEvents } from "../lib/capture";
import type { RecorderValue } from "../lib/requests";

/**
 * F3-01 "Rekam cara" (#214): the operator does the task once on the page while Nemu records the
 * locators and, while the talk combination is held, what they say (on the same clock). Selesai
 * hands the recording to the Nemu Service; the operator reviews, renames and saves it in the
 * Admin Workspace, where they are signed in. Nothing is compiled or saved from the page.
 */

export type RecorderView = { display: NemuDisplay | null; recording: boolean };

type Recording = {
  title: string;
  startedAt: number;
  events: RecordedEvent[];
  narration: NarrationSegment[];
};

type Phase =
  | { name: "idle" }
  | { name: "recording" }
  | { name: "saving" }
  | { name: "saved"; recordingId: string; steps: number }
  | { name: "notice"; sentence: string; retry?: () => void };

type Context = { pageEmail: PageEmail; honorific: string; speak: (text: string) => void };

const DEFAULT_TITLE = "Cara baru";

function createRecorder() {
  const listeners = new Set<() => void>();
  let context: Context = { pageEmail: { kind: "unreadable" }, honorific: "", speak: () => {} };
  let view: RecorderView = { display: null, recording: false };
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

  function displayFor(): NemuDisplay | null {
    switch (phase.name) {
      case "idle":
        return null;
      case "recording":
        return {
          type: "jawab",
          sentence: `Nemu merekam “${recording?.title ?? DEFAULT_TITLE}”. Kerjakan seperti biasa; tahan Ctrl + Spasi untuk menjelaskan.`,
          status: { tone: "working", text: `Merekam · ${stepCount()} langkah` },
          action: { label: "Selesai", onSelect: () => void finish() },
          onClose: () => cancel(),
        };
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
    view = { display: displayFor(), recording: phase.name === "recording" };
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

  async function finish() {
    if (!recording) return;
    stopCapture?.();
    stopCapture = null;
    if (!recording.events.length)
      return setPhase({ name: "notice", sentence: "Belum ada langkah yang terekam." });
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

  function cancel() {
    void call({ op: "state-save", state: null });
    reset();
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
    },
    start,
    finish,
    cancel,

    /** The talk combination went down: narration starts now, on the recording's clock. */
    talkStarted() {
      if (phase.name === "recording") talkStartedAt = Date.now();
    },

    /** What the operator said while recording becomes narration, not a question. */
    narrate(text: string): boolean {
      if (phase.name !== "recording" || !recording) return false;
      const end = Date.now() - recording.startedAt;
      const start = talkStartedAt === null ? end : talkStartedAt - recording.startedAt;
      talkStartedAt = null;
      if (text.trim())
        recording.narration.push({ start: Math.max(0, start), end, text: text.trim() });
      keep();
      publish();
      return true;
    },

    /** After a page load: carry on recording if Nemu was (F0-13). */
    async restore() {
      const response = await call({ op: "state-load" });
      const saved = response.ok ? (response.value as Recording | null) : null;
      if (!saved) return;
      recording = saved;
      setPhase({ name: "recording" });
      listen();
    },

    /** For tests and the review link: what was captured so far. */
    snapshot: () => recording,
  };
}

/** The page's one recorder (#214). */
export const recorder = createRecorder();
