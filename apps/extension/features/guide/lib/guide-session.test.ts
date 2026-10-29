import type { NemuGuide } from "@nemu/contracts";
import { describe, expect, test } from "vite-plus/test";

import { clearGuideSession, reserveGuideFollowUp, syncGuideSession } from "./guide-session";

const createGuide: NemuGuide = {
  id: "travel-request:create",
  steps: [
    { id: "type", target: "select-type", label: "Pilih jenis perjalanan" },
    { id: "destination", target: "select-destination", label: "Pilih tujuan" },
  ],
  current_step: 1,
};

describe("guide session", () => {
  test("starts, advances from the server step, replaces, and clears a guide", () => {
    const started = syncGuideSession(null, "Mulai dari mana?", createGuide);

    expect(started).toMatchObject({
      prompt: "Mulai dari mana?",
      guideId: "travel-request:create",
      steps: createGuide.steps,
      currentStep: 1,
      visitedSignatures: [],
    });

    const advanced = syncGuideSession(started, "Mulai dari mana?", {
      ...createGuide,
      current_step: 2,
    });
    expect(advanced.currentStep).toBe(2);

    const replaced = syncGuideSession(advanced, "Pertanggungjawaban?", {
      id: "travel-request:accountability",
      steps: [{ id: "upload", target: "upload-report", label: "Unggah laporan" }],
      current_step: 1,
    });
    expect(replaced).toMatchObject({
      prompt: "Pertanggungjawaban?",
      guideId: "travel-request:accountability",
      currentStep: 1,
      visitedSignatures: [],
    });
    expect(clearGuideSession()).toBeNull();
  });

  test("reserves a page and step only once", () => {
    const started = syncGuideSession(null, "Mulai dari mana?", createGuide);
    const first = reserveGuideFollowUp(started, "https://app.demo/perdin/baru#form");
    const duplicate = reserveGuideFollowUp(
      first.session,
      "https://app.demo/perdin/baru#different-fragment",
    );

    expect(first.shouldFollowUp).toBe(true);
    expect(first.session.visitedSignatures).toEqual([
      "travel-request:create:1:https://app.demo/perdin/baru",
    ]);
    expect(duplicate.shouldFollowUp).toBe(false);
    expect(duplicate.session).toBe(first.session);
  });
});
