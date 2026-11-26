import type { ShortCommand } from "../lib/short-commands";

/**
 * What a hold does while Nemu works (F0-15): `pause` when the hold starts, then either one
 * `command` or `resume` when nothing usable was heard.
 */
export type VoiceCommandEvent =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "command"; command: ShortCommand };

type Listener = (event: VoiceCommandEvent) => void;

function createVoiceCommands() {
  const listeners = new Set<Listener>();
  let executorWorking = false;
  return {
    /** The executor (#202) says when it runs steps, so a hold pauses it instead of asking. */
    setWorking(working: boolean) {
      executorWorking = working;
    },
    isWorking: () => executorWorking,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: VoiceCommandEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

/**
 * The page's one channel for spoken commands. Nemu's voice subscribes to it; the executor (#202)
 * subscribes too and calls `setWorking` while it runs.
 */
export const voiceCommands = createVoiceCommands();
