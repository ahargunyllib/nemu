// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { lodgingAmountStep as amount, notHotelStep as notHotel } from "../lib/guided-fixtures";
import { StepCard } from "./step-card";

const PLACE = { left: 40, top: 300, width: 280, height: 0 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCard(action: NemuAction, onClose = vi.fn()) {
  render(<StepCard action={action} place={PLACE} onClose={onClose} />);
  return { onClose };
}

describe("StepCard", () => {
  test("shows the note with the option to pick in bold", () => {
    renderCard(notHotel);

    const bold = screen.getByText('"Tidak menginap di hotel"');
    expect(bold.tagName).toBe("STRONG");
    expect(screen.getByRole("dialog").textContent).toBe(
      'Kamu menginap di rumah saudara, jadi pilih "Tidak menginap di hotel".',
    );
    expect(screen.queryByRole("button", { name: /Salin/ })).toBeNull();
  });

  test("Salin copies the step's value for Rina to paste", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderCard(amount);

    expect(screen.getByText("Rp447.000")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salin/ }));
    });

    expect(writeText).toHaveBeenCalledWith("Rp447.000");
    await waitFor(() => expect(screen.getByRole("button", { name: /Tersalin/ })).toBeTruthy());
  });

  test("× ends the guide", () => {
    const { onClose } = renderCard(notHotel);

    fireEvent.click(screen.getByRole("button", { name: "Akhiri panduan" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
