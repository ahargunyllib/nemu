// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AreaSelectLayer } from "./area-select-layer";

afterEach(cleanup);

function renderLayer() {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  render(<AreaSelectLayer onSelect={onSelect} onCancel={onCancel} />);
  const layer = screen.getByRole("application", { name: "Pilih area" });
  return { layer, onSelect, onCancel };
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
