/**
 * Press and hold to talk (F0-02/03). A hold shorter than `MIN_HOLD_MS` is a slip of the fingers and
 * sends nothing. A hold that starts while Nemu is working (speaking or running steps) pauses it and
 * listens for a short command (F0-15); while only the voice was speaking, anything else is a new
 * question.
 *
 * The first time she talks on a site, Chrome asks for the microphone (`asking`): Nemu points at
 * Izinkan until she answers, whatever her fingers do. A blocked microphone shows the steps to
 * allow it again (`blocked`). A `notice` is a sentence in place of what Nemu heard.
 */
export const MIN_HOLD_MS = 300;

export type TalkMode = "ask" | "command";

export type TalkState =
  | { phase: "idle" }
  | { phase: "listening"; mode: TalkMode; since: number }
  | { phase: "asking" }
  | { phase: "transcribing"; mode: TalkMode }
  | { phase: "blocked" }
  | { phase: "notice"; message: string };

export type TalkEvent =
  | { type: "press"; working: boolean; at: number }
  | { type: "release"; at: number }
  | { type: "cancel" }
  | { type: "transcribed" }
  | { type: "asking" }
  | { type: "blocked" }
  | { type: "notice"; message: string };

export const IDLE: TalkState = { phase: "idle" };

export function talkReducer(state: TalkState, event: TalkEvent): TalkState {
  switch (event.type) {
    case "press":
      if (state.phase === "listening" || state.phase === "transcribing" || state.phase === "asking")
        return state;
      return { phase: "listening", mode: event.working ? "command" : "ask", since: event.at };
    case "release":
      if (state.phase !== "listening") return state;
      return event.at - state.since < MIN_HOLD_MS
        ? IDLE
        : { phase: "transcribing", mode: state.mode };
    case "cancel":
      return state.phase === "listening" ? IDLE : state;
    case "transcribed":
      return state.phase === "transcribing" ? IDLE : state;
    case "asking":
      return state.phase === "listening" ? { phase: "asking" } : state;
    case "blocked":
      return { phase: "blocked" };
    case "notice":
      return { phase: "notice", message: event.message };
  }
}
