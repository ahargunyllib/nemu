import { describe, expect, test } from "vite-plus/test";

import { OPEN_COMPOSER_MESSAGE, isOpenComposerMessage } from "./open-composer-message";

describe("isOpenComposerMessage", () => {
  test("accepts the message the background sends", () => {
    expect(isOpenComposerMessage(OPEN_COMPOSER_MESSAGE)).toBe(true);
  });

  test("ignores chat requests and other messages", () => {
    expect(isOpenComposerMessage({ type: "nemu:chat", request: {} })).toBe(false);
    expect(isOpenComposerMessage("nemu:open-composer")).toBe(false);
    expect(isOpenComposerMessage(null)).toBe(false);
  });
});
