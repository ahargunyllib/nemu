// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { applyConfirmedFill } from "./confirmed-fill";

const fill: Extract<NemuAction, { type: "fill" }> = {
  type: "fill",
  target: "input-nominal-penginapan",
  level: "konfirmasi",
  label: "Isi Rp447.000",
  value: "447000",
};

afterEach(() => {
  document.body.innerHTML = "";
});

function renderRupiahField(target = fill.target) {
  const group = document.createElement("div");
  group.dataset.nemuId = target;
  const input = document.createElement("input");
  group.append(input);
  document.body.append(group);
  return input;
}

describe("applyConfirmedFill", () => {
  test("sets only the exact target through its native value setter and emits input then change", () => {
    const input = renderRupiahField();
    const other = renderRupiahField("input-uang-harian");
    const events: string[] = [];
    input.addEventListener("input", (event) => events.push(event.type));
    input.addEventListener("change", (event) => events.push(event.type));
    expect(applyConfirmedFill(fill)).toEqual({ status: "applied", element: input });

    expect(input.value).toBe("447000");
    expect(other.value).toBe("");
    expect(events).toEqual(["input", "change"]);
  });

  test("does not mutate anything when the exact target is missing", () => {
    const other = renderRupiahField("input-uang-harian");

    expect(applyConfirmedFill(fill)).toEqual({ status: "missing" });
    expect(other.value).toBe("");
  });

  test("rejects a target that contains no editable form control", () => {
    const target = document.createElement("button");
    target.dataset.nemuId = fill.target;
    document.body.append(target);

    expect(applyConfirmedFill(fill)).toEqual({ status: "unsupported" });
  });
});
