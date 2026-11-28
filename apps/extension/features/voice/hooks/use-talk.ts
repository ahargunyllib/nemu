import type { TalkShortcut } from "@nemu/contracts/talk-shortcut";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import {
  cancelListening,
  MICROPHONE_UNAVAILABLE,
  startListening,
  stopListening,
} from "../api/microphone";
import { requestTranscription } from "../api/request-voice";
import { microphoneReady, PROMPT_CLOSED } from "../lib/microphone-messages";
import { matchShortCommand } from "../lib/short-commands";
import { IDLE, type TalkEvent, talkReducer, type TalkState } from "../lib/talk-machine";
import { createHoldDetector } from "../lib/talk-shortcut";
import { isUnclear } from "../lib/unclear-speech";
import { voiceCommands } from "../stores/voice-commands";

type TalkOptions = {
  pageEmail: PageEmail;
  shortcut: TalkShortcut;
  /** Only a registered teacher is recorded; anyone else gets the panel with the reason. */
  enabled: boolean;
  /** Whether Nemu is speaking or running steps, so a hold pauses it for a short command. */
  isWorking: () => boolean;
  /** "Bu" or "Pak", for the sentences Nemu says about the microphone. */
  honorific: string;
  /** A hold began: open the panel. */
  onStart: () => void;
  /** A task waiting for an answer (a number, a choice, narration) takes the words; true if so. */
  onAnswer: (text: string) => boolean;
  /** What the teacher asked, when it isn't a short command or an answer. */
  onQuestion: (text: string) => void;
};

/**
 * Hold to talk (F0-02/03): the combination or a long press on the Nemu button records the site's
 * microphone; on release the heard text shows, then goes on as a question or a short command.
 * The first hold on a site makes Chrome ask (`asking`, Nemu points at Izinkan); a blocked
 * microphone shows the steps to allow it (`blocked`); words too unclear to act on are shown back
 * with a request to say them again (PRD v2.3).
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
    void startListening(() => dispatch({ type: "asking" })).then((started) => {
      if (started === "recording") return;
      const { honorific } = latest.current;
      if (started === "blocked") dispatch({ type: "blocked" });
      else if (started === "allowed")
        dispatch({ type: "notice", message: microphoneReady(honorific) });
      else if (started === "dismissed") dispatch({ type: "notice", message: PROMPT_CLOSED });
      // A hold already let go of has nothing to say about a microphone that failed.
      else if (current.current === next)
        dispatch({ type: "notice", message: MICROPHONE_UNAVAILABLE });
      if (next.mode === "command") voiceCommands.emit({ type: "resume" });
    });
  }, [dispatch]);

  const release = useCallback(async () => {
    const { previous, next } = dispatch({ type: "release", at: Date.now() });
    if (previous.phase !== "listening") return;
    const mode = previous.mode;
    if (next.phase === "idle") {
      void cancelListening();
      if (mode === "command") voiceCommands.emit({ type: "resume" });
      return;
    }
    const recording = await stopListening();
    const result = await requestTranscription(latest.current.pageEmail, recording);
    if (result.kind === "notice") {
      dispatch({ type: "notice", message: result.text });
      if (mode === "command") voiceCommands.emit({ type: "resume" });
      return;
    }
    const text = result.text;
    const command = matchShortCommand(text);
    const { onAnswer, onQuestion } = latest.current;
    if (command) {
      dispatch({ type: "transcribed" });
      setHeard(text);
      voiceCommands.emit({ type: "command", command });
    } else if (mode === "command" && voiceCommands.isWorking()) {
      // While steps run, anything else is ignored; while Nemu only spoke, it is a new question.
      dispatch({ type: "transcribed" });
      setHeard(text);
      voiceCommands.emit({ type: "resume" });
    } else if (onAnswer(text)) {
      dispatch({ type: "transcribed" });
      setHeard(text);
    } else if (isUnclear(text)) {
      // Nothing is done with it: Nemu shows what it caught and asks again.
      dispatch({ type: "unclear", words: text });
    } else {
      dispatch({ type: "transcribed" });
      setHeard(text);
      onQuestion(text);
    }
  }, [dispatch]);

  const cancel = useCallback(() => {
    const { previous } = dispatch({ type: "cancel" });
    if (previous.phase !== "listening") return;
    void cancelListening();
    if (previous.mode === "command") voiceCommands.emit({ type: "resume" });
  }, [dispatch]);

  /** Closes the heard text, a notice, unclear words and the blocked steps; a hold carries on. */
  const dismiss = useCallback(() => {
    const { phase } = current.current;
    if (phase === "notice" || phase === "unclear" || phase === "blocked") {
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
