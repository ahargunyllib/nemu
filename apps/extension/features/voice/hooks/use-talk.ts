import type { TalkShortcut } from "@nemu/contracts/talk-shortcut";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { requestListenCancel, requestListenStart, requestListenStop } from "../api/request-voice";
import { matchShortCommand } from "../lib/short-commands";
import { IDLE, type TalkEvent, talkReducer, type TalkState } from "../lib/talk-machine";
import { createHoldDetector } from "../lib/talk-shortcut";
import { voiceCommands } from "../stores/voice-commands";

type TalkOptions = {
  pageEmail: PageEmail;
  shortcut: TalkShortcut;
  /** Only a registered teacher is recorded; anyone else gets the panel with the reason. */
  enabled: boolean;
  /** Whether Nemu is speaking or running steps, so a hold pauses it for a short command. */
  isWorking: () => boolean;
  /** A hold began: open the panel. */
  onStart: () => void;
  /** What the teacher asked, when it isn't a short command. */
  onQuestion: (text: string) => void;
};

/**
 * Hold to talk (F0-02/03): the combination or a long press on the Nemu button records through the
 * background; on release the heard text shows, then goes on as a question or a short command.
 */
export function useTalk(options: TalkOptions) {
  const [state, setState] = useState<TalkState>(IDLE);
  const [heard, setHeard] = useState<string | null>(null);
  const current = useRef<TalkState>(IDLE);
  const latest = useRef(options);
  latest.current = options;

  const dispatch = useCallback((event: TalkEvent) => {
    const previous = current.current;
    const next = talkReducer(previous, event);
    current.current = next;
    setState(next);
    return { previous, next };
  }, []);

  const press = useCallback(() => {
    const { enabled, isWorking, onStart } = latest.current;
    onStart();
    if (!enabled) return;
    const { previous, next } = dispatch({ type: "press", working: isWorking(), at: Date.now() });
    if (next === previous || next.phase !== "listening") return;
    setHeard(null);
    if (next.mode === "command") voiceCommands.emit({ type: "pause" });
    void requestListenStart().then((started) => {
      if (started.ok || current.current !== next) return;
      dispatch({ type: "failed", message: started.message });
      if (next.mode === "command") voiceCommands.emit({ type: "resume" });
    });
  }, [dispatch]);

  const release = useCallback(async () => {
    const { previous, next } = dispatch({ type: "release", at: Date.now() });
    if (previous.phase !== "listening") return;
    const mode = previous.mode;
    if (next.phase === "idle") {
      void requestListenCancel();
      if (mode === "command") voiceCommands.emit({ type: "resume" });
      return;
    }
    const result = await requestListenStop(latest.current.pageEmail);
    if (result.kind === "notice") {
      dispatch({ type: "failed", message: result.text });
      if (mode === "command") voiceCommands.emit({ type: "resume" });
      return;
    }
    dispatch({ type: "transcribed" });
    setHeard(result.text);
    const command = matchShortCommand(result.text);
    if (command) voiceCommands.emit({ type: "command", command });
    // While steps run, anything else is ignored; while Nemu only spoke, it is a new question.
    else if (mode === "command" && voiceCommands.isWorking())
      voiceCommands.emit({ type: "resume" });
    else latest.current.onQuestion(result.text);
  }, [dispatch]);

  const cancel = useCallback(() => {
    const { previous } = dispatch({ type: "cancel" });
    if (previous.phase !== "listening") return;
    void requestListenCancel();
    if (previous.mode === "command") voiceCommands.emit({ type: "resume" });
  }, [dispatch]);

  /** Closes the heard text and a failure message; a hold in progress carries on. */
  const dismiss = useCallback(() => {
    if (current.current.phase === "failed") {
      current.current = IDLE;
      setState(IDLE);
    }
    setHeard(null);
  }, []);

  const { shortcut } = options;
  useEffect(() => {
    const detector = createHoldDetector(shortcut);
    // Capture on the window, before the page or the overlay's isolated keys see it.
    const onKeyDown = (event: KeyboardEvent) => {
      const signal = detector.keydown(event);
      if (!signal) return;
      event.preventDefault();
      event.stopPropagation();
      if (signal === "press") press();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (detector.keyup(event) !== "release") return;
      if (event.code === shortcut.code) event.preventDefault();
      void release();
    };
    const onBlur = () => {
      if (detector.cancel()) cancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [shortcut, press, release, cancel]);

  return { state, heard, press, release: () => void release(), dismiss };
}
