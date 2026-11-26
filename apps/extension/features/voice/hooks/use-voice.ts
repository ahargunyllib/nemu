import type { SpeechSynthesis } from "@nemu/contracts/school";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { requestSpeech } from "../api/request-voice";
import { localSpeech, type Playback, playSpeech } from "../lib/voice-player";
import { mainSentence } from "../lib/word-timing";
import { voiceCommands } from "../stores/voice-commands";

/** The sentence Nemu speaks, its words as spoken, and the one to highlight. */
export type VoiceState = {
  sentence: string;
  words: string[];
  activeIndex: number;
  status: "loading" | "speaking" | "paused" | "done";
};

/**
 * Nemu's voice (F0-05): speaks the main sentence of a bubble with the word highlight, repeats it
 * on a click or "ulangi", slows down on "pelan", and pauses while the teacher holds to talk.
 */
export function useVoice(pageEmail: PageEmail) {
  const [voice, setVoice] = useState<VoiceState | null>(null);
  const playback = useRef<Playback | null>(null);
  const spoken = useRef<{ sentence: string; speech: SpeechSynthesis } | null>(null);
  const latest = useRef(0);

  const play = useCallback((slow: boolean) => {
    const current = spoken.current;
    if (!current) return;
    playback.current?.stop();
    setVoice({
      sentence: current.sentence,
      words: current.speech.words.map((word) => word.text),
      activeIndex: -1,
      status: "speaking",
    });
    playback.current = playSpeech(current.speech, {
      slow,
      onWord: (activeIndex) => setVoice((state) => state && { ...state, activeIndex }),
      onEnd: () => setVoice((state) => state && { ...state, activeIndex: -1, status: "done" }),
    });
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const sentence = mainSentence(text);
      if (!sentence) return;
      const id = ++latest.current;
      playback.current?.stop();
      setVoice({ sentence, words: sentence.split(/\s+/u), activeIndex: -1, status: "loading" });
      const speech = (await requestSpeech(pageEmail, sentence)) ?? localSpeech(sentence);
      if (id !== latest.current) return;
      spoken.current = { sentence, speech };
      play(false);
    },
    [pageEmail, play],
  );

  const stop = useCallback(() => {
    latest.current += 1;
    playback.current?.stop();
    playback.current = null;
    setVoice((state) => state && { ...state, activeIndex: -1, status: "done" });
  }, []);

  const repeat = useCallback(() => play(false), [play]);

  useEffect(
    () =>
      voiceCommands.subscribe((event) => {
        const command = event.type === "command" ? event.command : event.type;
        switch (command) {
          case "pause":
            playback.current?.pause();
            setVoice((state) =>
              state?.status === "speaking" ? { ...state, status: "paused" } : state,
            );
            return;
          case "resume":
          case "lanjut":
          case "ajari_saya":
            playback.current?.resume();
            setVoice((state) =>
              state?.status === "paused" ? { ...state, status: "speaking" } : state,
            );
            return;
          case "ulangi":
            return play(false);
          case "pelan":
            return play(true);
          case "berhenti":
            return stop();
        }
      }),
    [play, stop],
  );

  useEffect(() => () => playback.current?.stop(), []);

  const working = voice !== null && voice.status !== "done";
  return { voice, working, speak, repeat, stop };
}
