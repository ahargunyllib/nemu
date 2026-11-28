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

  test("a notice shows its message until the next press", () => {
    const notice = run([
      { type: "press", working: false, at: 0 },
      { type: "notice", message: "Mikrofon tidak bisa dipakai." },
    ]);
    expect(notice).toEqual({ phase: "notice", message: "Mikrofon tidak bisa dipakai." });
    expect(talkReducer(notice, { type: "press", working: false, at: 10 }).phase).toBe("listening");
  });

  test("while Chrome asks for the microphone, releasing, losing focus or pressing again keeps Nemu pointing", () => {
    const asking = run([{ type: "press", working: false, at: 0 }, { type: "asking" }]);
    expect(asking).toEqual({ phase: "asking" });
    expect(talkReducer(asking, { type: "release", at: 2_000 })).toBe(asking);
    expect(talkReducer(asking, { type: "cancel" })).toBe(asking);
    expect(talkReducer(asking, { type: "press", working: false, at: 3_000 })).toBe(asking);
  });

  test("once the teacher allows it, Nemu says the microphone is ready instead of recording", () => {
    expect(
      run([
        { type: "press", working: false, at: 0 },
        { type: "asking" },
        { type: "notice", message: "Mikrofon sudah siap." },
      ]),
    ).toEqual({ phase: "notice", message: "Mikrofon sudah siap." });
  });

  test("a blocked microphone shows the steps until the next press", () => {
    const blocked = run([{ type: "press", working: false, at: 0 }, { type: "blocked" }]);
    expect(blocked).toEqual({ phase: "blocked" });
    expect(talkReducer(blocked, { type: "release", at: 900 })).toBe(blocked);
    expect(talkReducer(blocked, { type: "press", working: false, at: 10 }).phase).toBe("listening");
  });

  test("the blocked steps also follow a refusal in Chrome's prompt", () => {
    expect(
      run([{ type: "press", working: false, at: 0 }, { type: "asking" }, { type: "blocked" }]),
    ).toEqual({
      phase: "blocked",
    });
  });

  test("losing focus mid-hold drops the recording", () => {
    expect(run([{ type: "press", working: false, at: 0 }, { type: "cancel" }])).toEqual(IDLE);
  });
});
