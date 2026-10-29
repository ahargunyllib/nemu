// @vitest-environment happy-dom
import type { NemuGuide } from "@nemu/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { HighlightStep } from "../lib/highlight-targets";
import { HighlightSteps } from "./highlight-steps";

afterEach(cleanup);

describe("HighlightSteps", () => {
  test("renders canonical server progress even when this page has one local action", () => {
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

    render(<HighlightSteps steps={steps} guide={guide} index={0} onGoTo={vi.fn()} />);

    expect(screen.getByText(/Langkah 2 dari 2/)).toBeTruthy();
    expect(screen.getByText("2. Pilih kota tujuan")).toBeTruthy();
    expect(screen.queryByText("Local fallback label")).toBeNull();
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

    render(<HighlightSteps steps={steps} guide={guide} index={1} onGoTo={vi.fn()} />);

    expect(screen.getByText(/Langkah 3 dari 3/)).toBeTruthy();
    expect(screen.getByText("3. Isi maksud perjalanan").getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("2. Pilih kota tujuan").getAttribute("aria-current")).toBeNull();
  });
});
