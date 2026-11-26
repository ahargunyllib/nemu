// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { NemuDisplay } from "../lib/nemu-display";
import { GLIDE_MS, NemuStage } from "./nemu-stage";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function pageField(rect: { left: number; top: number; width: number; height: number }) {
  const field = document.createElement("select");
  field.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => rect,
    }) as DOMRect;
  document.body.append(field);
  return field;
}

const tunjuk: NemuDisplay = { type: "tunjuk", sentence: "Pilih kelas 4A di sini." };

describe("NemuStage", () => {
  test("the cursor glides to the target first; the bubble speaks only once it arrives", () => {
    const field = pageField({ left: 200, top: 300, width: 240, height: 40 });
    const onShown = vi.fn();
    render(<NemuStage display={tunjuk} target={field} onShown={onShown} />);

    expect(screen.queryByRole("region")).toBeNull();
    expect(onShown).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(GLIDE_MS));

    const cursor = document.querySelector("[data-nemu-cursor]");
    expect(cursor?.getAttribute("data-nemu-cursor")).toBe("arrived");
    const x = Number(cursor?.getAttribute("data-x"));
    const y = Number(cursor?.getAttribute("data-y"));
    expect(x).toBeGreaterThan(440);
    expect(x).toBeLessThan(470);
    expect(y).toBeGreaterThanOrEqual(300);
    expect(y).toBeLessThanOrEqual(340);

    expect(document.querySelector("[data-nemu-ring]")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Petunjuk Nemu" })).toBeTruthy();
    expect(onShown).toHaveBeenCalledWith(tunjuk);
  });

  test("moving to the next target glides again before the bubble returns", () => {
    const first = pageField({ left: 200, top: 300, width: 240, height: 40 });
    const second = pageField({ left: 200, top: 420, width: 160, height: 40 });
    const { rerender } = render(<NemuStage display={tunjuk} target={first} />);
    act(() => vi.advanceTimersByTime(GLIDE_MS));

    const next: NemuDisplay = { type: "tunjuk", sentence: "Lalu tekan Tampilkan Siswa." };
    rerender(<NemuStage display={next} target={second} />);
    expect(document.querySelector("[data-nemu-cursor]")?.getAttribute("data-nemu-cursor")).toBe(
      "gliding",
    );
    expect(screen.queryByRole("region")).toBeNull();

    act(() => vi.advanceTimersByTime(GLIDE_MS));
    expect(Number(document.querySelector("[data-nemu-cursor]")?.getAttribute("data-y"))).toBe(440);
    expect(screen.getByRole("region").textContent).toContain("Lalu tekan Tampilkan Siswa.");
  });

  test("shows one display at a time", () => {
    const { rerender, container } = render(
      <NemuStage display={{ type: "jawab", sentence: "KKM 75." }} />,
    );
    rerender(
      <NemuStage
        display={{
          type: "pilih",
          question: "Lanjut?",
          choices: [
            { id: "ya", label: "Nemu lanjut" },
            { id: "tidak", label: "Berhenti" },
          ],
          onChoose: vi.fn(),
        }}
      />,
    );
    const shown = container.querySelectorAll("[data-nemu-display]");
    expect(shown).toHaveLength(1);
    expect(shown[0]?.getAttribute("data-nemu-display")).toBe("pilih");
  });
});
