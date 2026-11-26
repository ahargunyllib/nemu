import { describe, expect, test } from "vite-plus/test";

import { IDLE, MIN_HOLD_MS, type TalkEvent, talkReducer, type TalkState } from "./talk-machine";

function run(events: TalkEvent[], from: TalkState = IDLE): TalkState {
  return events.reduce(talkReducer, from);
}

describe("talkReducer", () => {
  test("a full hold asks a question: listening, then transcribing, then idle", () => {
    const listening = run([{ type: "press", working: false, at: 1_000 }]);
    expect(listening).toEqual({ phase: "listening", mode: "ask", since: 1_000 });
    const transcribing = talkReducer(listening, { type: "release", at: 2_500 });
    expect(transcribing).toEqual({ phase: "transcribing", mode: "ask" });
    expect(talkReducer(transcribing, { type: "transcribed" })).toEqual(IDLE);
  });

  test("holding while Nemu works listens for a short command", () => {
    expect(
      run([
        { type: "press", working: true, at: 0 },
        { type: "release", at: 900 },
      ]),
    ).toEqual({ phase: "transcribing", mode: "command" });
  });

  test("a tap shorter than the minimum hold sends nothing", () => {
    expect(
      run([
        { type: "press", working: false, at: 0 },
        { type: "release", at: MIN_HOLD_MS - 1 },
      ]),
    ).toEqual(IDLE);
  });

  test("a second press while Nemu still transcribes is ignored", () => {
    const transcribing: TalkState = { phase: "transcribing", mode: "ask" };
    expect(talkReducer(transcribing, { type: "press", working: false, at: 5 })).toBe(transcribing);
    expect(talkReducer(transcribing, { type: "cancel" })).toBe(transcribing);
  });

  test("a failure shows its message until the next press", () => {
    const failed = run([
      { type: "press", working: false, at: 0 },
      { type: "failed", message: "Mikrofon belum diizinkan." },
    ]);
    expect(failed).toEqual({ phase: "failed", message: "Mikrofon belum diizinkan." });
    expect(talkReducer(failed, { type: "press", working: false, at: 10 }).phase).toBe("listening");
  });

  test("losing focus mid-hold drops the recording", () => {
    expect(run([{ type: "press", working: false, at: 0 }, { type: "cancel" }])).toEqual(IDLE);
  });
});
