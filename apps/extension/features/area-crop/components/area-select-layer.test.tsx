// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AreaSelectLayer } from "./area-select-layer";

afterEach(cleanup);

function renderLayer() {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  const onDrag = vi.fn();
  render(<AreaSelectLayer onSelect={onSelect} onCancel={onCancel} onDrag={onDrag} />);
  const layer = screen.getByRole("application", { name: "Pilih area" });
  return { layer, onSelect, onCancel, onDrag };
}

function drag(layer: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(layer, { pointerId: 1, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(layer, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(layer, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

describe("AreaSelectLayer", () => {
  test("selects the box Rina drags", () => {
    const { layer, onSelect } = renderLayer();

    drag(layer, [560, 440], [40, 300]);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith({
      left: 40,
      top: 300,
      width: 520,
      height: 140,
    });
  });

  test("outlines the box while it is dragged and reports it, for the mascot to sit at its corner", () => {
    const { layer, onDrag } = renderLayer();

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 40, clientY: 300 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 560, clientY: 440 });

    const box = { left: 40, top: 300, width: 520, height: 140 };
    expect(onDrag).toHaveBeenLastCalledWith(box);
    expect(layer.querySelector<HTMLElement>("[data-nemu-area=selected]")?.style).toMatchObject({
      left: "40px",
      top: "300px",
      width: "520px",
      height: "140px",
    });

    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 560, clientY: 440 });

    expect(onDrag).toHaveBeenLastCalledWith(null);
    expect(layer.querySelector("[data-nemu-area]")).toBeNull();
  });

  test("ignores a plain click", () => {
    const { layer, onSelect } = renderLayer();

    drag(layer, [200, 200], [202, 201]);

    expect(onSelect).not.toHaveBeenCalled();
  });

  test("leaves area select mode on Esc", () => {
    const { layer, onSelect, onCancel } = renderLayer();

    fireEvent.keyDown(layer, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
