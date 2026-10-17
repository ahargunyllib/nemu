// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AreaCropChip } from "../../area-crop/components/area-crop-chip";
import { Composer } from "./composer";

afterEach(cleanup);

function renderComposer(attachment?: React.ReactNode) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const onPickArea = vi.fn();
  render(
    <Composer onSubmit={onSubmit} onCancel={onCancel} onPickArea={onPickArea}>
      {attachment}
    </Composer>,
  );
  const input = screen.getByRole("textbox", { name: "Pertanyaan untuk Nemu" });
  return { input, onSubmit, onCancel, onPickArea };
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

  test("starts area select mode from its button without sending", () => {
    const { onPickArea, onSubmit } = renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pilih area" }));

    expect(onPickArea).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("shows the attached Area Crop as a chip that can be removed", () => {
    const onRemove = vi.fn();
    renderComposer(
      <AreaCropChip
        state={{ kind: "attached", crop: "data:image/png;base64,AREA" }}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByRole("img", { name: "Area Crop" })).toHaveProperty(
      "src",
      "data:image/png;base64,AREA",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus Area Crop" }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
