import { describe, expect, test } from "vite-plus/test";

import { toCaptureViewportFailure, toCaptureViewportResult } from "./capture-message";

describe("toCaptureViewportFailure", () => {
  test("tells a tab without an activeTab grant apart from other failures", () => {
    const noGrant = new Error("Either the '<all_urls>' or 'activeTab' permission is required.");

    expect(toCaptureViewportFailure(noGrant)).toEqual({ ok: false, reason: "no-tab-access" });
    expect(toCaptureViewportFailure(new Error("Tabs cannot be edited right now"))).toEqual({
      ok: false,
    });
  });

  test("keeps the reason when the content script reads the answer", () => {
    expect(toCaptureViewportResult({ ok: false, reason: "no-tab-access" })).toEqual({
      ok: false,
      reason: "no-tab-access",
    });
  });
});
