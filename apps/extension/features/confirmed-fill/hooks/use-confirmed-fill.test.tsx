// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { ConfirmedFillControl } from "../components/confirmed-fill-control";
import type { FillAction } from "../lib/confirmed-fill";
import { useConfirmedFill } from "./use-confirmed-fill";

const lodging: FillAction = {
  type: "fill",
  target: "input-nominal-penginapan",
  level: "konfirmasi",
  label: "Isi Rp447.000",
  value: "447000",
};

const dailyAllowance: FillAction = {
  type: "fill",
  target: "input-uang-harian",
  level: "konfirmasi",
  label: "Isi Rp580.000",
  value: "580000",
};

const BOX = { left: 40, top: 300, width: 200, height: 32 };

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function renderField(target: string) {
  const group = document.createElement("div");
  group.dataset.nemuId = target;
  const input = document.createElement("input");
  group.append(input);
  document.body.append(group);
  return input;
}

function Harness({ actions, current }: { actions: NemuAction[]; current?: NemuAction }) {
  const controls = useConfirmedFill(actions, current && { action: current, box: BOX });
  return controls.map((control) => (
    <ConfirmedFillControl key={`${control.mode}:${control.action.target}`} control={control} />
  ));
}

describe("useConfirmedFill", () => {
  test("offers each fill in an answer on its own, after an earlier fill was applied", async () => {
    const lodgingInput = renderField(lodging.target);
    const allowanceInput = renderField(dailyAllowance.target);
    const actions = [lodging, dailyAllowance];
    const { rerender } = render(<Harness actions={actions} current={lodging} />);

    fireEvent.click(screen.getByRole("button", { name: "Isi Rp447.000" }));
    await waitFor(() => expect(lodgingInput.value).toBe("447000"));

    rerender(<Harness actions={actions} current={dailyAllowance} />);
    expect(allowanceInput.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Isi Rp580.000" }));

    await waitFor(() => expect(allowanceInput.value).toBe("580000"));
    expect(lodgingInput.value).toBe("447000");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("keeps warning about an earlier fill Rina changed while the next fill is offered", async () => {
    const lodgingInput = renderField(lodging.target);
    renderField(dailyAllowance.target);
    const actions = [lodging, dailyAllowance];
    const { rerender } = render(<Harness actions={actions} current={lodging} />);

    fireEvent.click(screen.getByRole("button", { name: "Isi Rp447.000" }));
    await waitFor(() => expect(lodgingInput.value).toBe("447000"));
    rerender(<Harness actions={actions} current={dailyAllowance} />);
    fireEvent.input(lodgingInput, { target: { value: "745000" } });

    expect(await screen.findByText("Tidak sesuai hitungan Rp447.000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Isi Rp580.000" })).toBeTruthy();
  });

  test("offers no button when the label names a different amount than the value it writes", () => {
    const input = renderField(lodging.target);
    const swapped: FillAction = { ...lodging, label: "Isi Rp447.000", value: "745000" };

    render(<Harness actions={[swapped]} current={swapped} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(input.value).toBe("");
  });
});
