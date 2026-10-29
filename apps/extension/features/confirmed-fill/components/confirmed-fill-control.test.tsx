// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { useConfirmedFill } from "../hooks/use-confirmed-fill";
import { ConfirmedFillControl } from "./confirmed-fill-control";

const fill: Extract<NemuAction, { type: "fill" }> = {
  type: "fill",
  target: "input-nominal-penginapan",
  level: "konfirmasi",
  label: "Isi Rp447.000",
  value: "447000",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function renderTarget() {
  const group = document.createElement("div");
  group.dataset.nemuId = fill.target;
  group.getBoundingClientRect = () => new DOMRect(40, 300, 200, 32);
  const input = document.createElement("input");
  group.append(input);
  document.body.append(group);
  return input;
}

function Harness() {
  const control = useConfirmedFill([fill], {
    action: fill,
    box: { left: 40, top: 300, width: 200, height: 32 },
  });
  return control ? <ConfirmedFillControl control={control} /> : null;
}

describe("ConfirmedFillControl", () => {
  test("waits for confirmation, applies the raw value, then warns after a manual mismatch", async () => {
    const input = renderTarget();
    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    input.addEventListener("input", inputEvents);
    input.addEventListener("change", changeEvents);
    render(<Harness />);

    expect(input.value).toBe("");
    expect(screen.getByRole("button", { name: "Isi Rp447.000" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Isi Rp447.000" }));

    await waitFor(() => expect(input.value).toBe("447000"));
    expect(inputEvents).toHaveBeenCalledOnce();
    expect(changeEvents).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Isi Rp447.000" })).toBeNull();
    expect(screen.queryByText("Tidak sesuai hitungan Rp447.000")).toBeNull();

    fireEvent.input(input, { target: { value: "745000" } });
    fireEvent.change(input);

    expect(await screen.findByText("Tidak sesuai hitungan Rp447.000")).toBeTruthy();
    expect(input.value).toBe("745000");
  });
});
