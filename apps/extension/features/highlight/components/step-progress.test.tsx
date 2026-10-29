// @vitest-environment happy-dom
import type { NemuGuide } from "@nemu/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import type { HighlightStep } from "../lib/highlight-targets";
import { StepProgress } from "./step-progress";

afterEach(cleanup);

describe("StepProgress", () => {
  test("counts canonical server progress even when this page has one local action", () => {
    const steps: HighlightStep[] = [
      {
        action: {
          type: "highlight",
          target: "select-destination",
          level: "arahkan",
          label: "Local fallback label",
        },
        position: 0,
      },
    ];
    const guide: NemuGuide = {
      id: "travel-request:create",
      steps: [
        { id: "type", target: "select-type", label: "Pilih jenis perjalanan" },
        { id: "destination", target: "select-destination", label: "Pilih kota tujuan" },
      ],
      current_step: 2,
    };

    const { container } = render(<StepProgress steps={steps} guide={guide} index={0} />);

    expect(container.textContent).toBe("Langkah 2 dari 2");
  });

  test("numbers each step by its place in the guide when a target before it is missing", () => {
    // The guide highlights three fields on this page, but "Pilih kota tujuan" is not on it, so
    // only the first and third were found.
    const guide: NemuGuide = {
      id: "travel-request:create",
      steps: [
        { id: "type", target: "select-type", label: "Pilih jenis perjalanan" },
        { id: "destination", target: "select-destination", label: "Pilih kota tujuan" },
        { id: "purpose", target: "input-purpose", label: "Isi maksud perjalanan" },
      ],
      current_step: 1,
    };
    const steps: HighlightStep[] = [
      {
        action: {
          type: "highlight",
          target: "select-type",
          level: "arahkan",
          label: "Pilih jenis perjalanan",
        },
        position: 0,
      },
      {
        action: {
          type: "highlight",
          target: "input-purpose",
          level: "arahkan",
          label: "Isi maksud perjalanan",
        },
        position: 2,
      },
    ];

    render(<StepProgress steps={steps} guide={guide} index={1} />);

    expect(screen.getByText("Langkah 3 dari 3")).toBeTruthy();
  });

  test("shows nothing once the last step is done", () => {
    const steps: HighlightStep[] = ["select-type", "input-purpose"].map((target, position) => ({
      action: { type: "highlight", target, level: "arahkan", label: target },
      position,
    }));

    const { container } = render(<StepProgress steps={steps} index={2} />);

    expect(container.textContent).toBe("");
  });
});
