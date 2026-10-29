// @vitest-environment happy-dom
import type { NemuAction, NemuGuide } from "@nemu/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { HighlightSteps } from "./highlight-steps";

afterEach(cleanup);

describe("HighlightSteps", () => {
  test("renders canonical server progress even when this page has one local action", () => {
    const steps: NemuAction[] = [
      {
        type: "highlight",
        target: "select-destination",
        level: "arahkan",
        label: "Local fallback label",
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
    expect(screen.getByText("Pilih kota tujuan")).toBeTruthy();
    expect(screen.queryByText("Local fallback label")).toBeNull();
  });
});
