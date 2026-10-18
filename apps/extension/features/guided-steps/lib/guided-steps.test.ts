import { momentThreeFollowUpResponse, momentThreeResponse } from "@nemu/contracts/fixtures";
import { describe, expect, test } from "vite-plus/test";

import { momentOneGuidedActions, momentTwoGuidedActions } from "./guided-fixtures";
import { isGuided, noteSegments, placeStepCard, STEP_CARD_WIDTH } from "./guided-steps";

const VIEWPORT = { width: 1280, height: 800 };

describe("isGuided", () => {
  test("answers whose steps carry a note run as guided steps", () => {
    expect(isGuided(momentOneGuidedActions)).toBe(true);
    expect(isGuided(momentTwoGuidedActions)).toBe(true);
  });

  test("answers without notes keep the Answer Card", () => {
    // Momen 3 has no step notes; Momen 1 and 2 gain them in the shared fixtures (#85).
    expect(isGuided(momentThreeResponse.actions)).toBe(false);
    expect(isGuided(momentThreeFollowUpResponse.actions)).toBe(false);
  });
});

describe("noteSegments", () => {
  test("marks the **bold** option to pick", () => {
    expect(noteSegments('Jadi pilih **"Tidak menginap di hotel"**. Kamu tetap dapat 30%.')).toEqual(
      [
        { text: "Jadi pilih ", bold: false },
        { text: '"Tidak menginap di hotel"', bold: true },
        { text: ". Kamu tetap dapat 30%.", bold: false },
      ],
    );
  });

  test("keeps an unpaired ** as written", () => {
    expect(noteSegments("Isi **Makassar")).toEqual([{ text: "Isi **Makassar", bold: false }]);
  });
});

describe("placeStepCard", () => {
  const field = { left: 300, top: 200, width: 400, height: 36 };

  test("goes below the field when there is room, so it never covers it", () => {
    const card = placeStepCard(field, VIEWPORT, 120);
    expect(card.top).toBeGreaterThan(field.top + field.height);
    expect(card.width).toBe(STEP_CARD_WIDTH);
  });

  test("goes above a field near the viewport's bottom, clear of its label", () => {
    const low = { ...field, top: 700 };
    const card = placeStepCard(low, VIEWPORT, 120);
    expect(card.top + card.height).toBeLessThan(low.top - 28);
  });

  test("stays inside the viewport near its right edge", () => {
    const card = placeStepCard({ ...field, left: 1200, width: 60 }, VIEWPORT, 120);
    expect(card.left + card.width).toBeLessThanOrEqual(VIEWPORT.width);
  });
});
