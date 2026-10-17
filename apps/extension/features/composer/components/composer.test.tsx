// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { Composer } from "./composer";

afterEach(cleanup);

function renderComposer() {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<Composer onSubmit={onSubmit} onCancel={onCancel} />);
  const input = screen.getByRole("textbox", { name: "Pertanyaan untuk Nemu" });
  return { input, onSubmit, onCancel };
}

describe("Composer", () => {
  test("sends the trimmed prompt on Enter", () => {
    const { input, onSubmit } = renderComposer();

    fireEvent.change(input, { target: { value: "  Mulai dari mana?  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Mulai dari mana?");
  });

  test("keeps Shift+Enter for a new line", () => {
    const { input, onSubmit } = renderComposer();

    fireEvent.change(input, { target: { value: "Baris pertama" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("cancels on Esc without sending", () => {
    const { input, onSubmit, onCancel } = renderComposer();

    fireEvent.change(input, { target: { value: "Mulai dari mana?" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("does not send an empty prompt", () => {
    const { input, onSubmit } = renderComposer();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
