import { describe, expect, test } from "vite-plus/test";

import { type MascotActivity, mascotStateFor } from "./mascot-state";

const NOTHING: MascotActivity = {
  listening: false,
  thinking: false,
  clicking: false,
  guiding: false,
  succeeded: false,
  failed: false,
};

function stateFor(activity: Partial<MascotActivity>, rested = false) {
  return mascotStateFor({ ...NOTHING, ...activity }, rested);
}

describe("mascotStateFor", () => {
  test("follows a prompt from the Composer to Nemu's answer", () => {
    expect(stateFor({})).toBe("idle");
    expect(stateFor({ listening: true })).toBe("listening");
    expect(stateFor({ thinking: true })).toBe("thinking");
    expect(stateFor({ clicking: true })).toBe("clicking");
    expect(stateFor({ guiding: true })).toBe("guiding");
  });

  test("shows success when Nemu's click opens the page, then guides any highlights", () => {
    expect(stateFor({ succeeded: true, guiding: true })).toBe("success");
    expect(stateFor({ succeeded: true, guiding: true }, true)).toBe("guiding");
    expect(stateFor({ succeeded: true }, true)).toBe("idle");
  });

  test("warns when something failed, then rests", () => {
    expect(stateFor({ failed: true })).toBe("warning");
    // A click that changed nothing falls back to a highlight on its target.
    expect(stateFor({ failed: true, guiding: true }, true)).toBe("guiding");
    expect(stateFor({ failed: true }, true)).toBe("idle");
  });

  test("the Composer, a pending answer, and a running click outrank an earlier result", () => {
    expect(stateFor({ listening: true, failed: true })).toBe("listening");
    expect(stateFor({ thinking: true, succeeded: true })).toBe("thinking");
    expect(stateFor({ clicking: true, failed: true })).toBe("clicking");
  });
});
