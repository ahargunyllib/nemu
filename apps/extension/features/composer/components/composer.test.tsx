// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AreaCropChip } from "../../area-crop/components/area-crop-chip";
import { Composer } from "./composer";

afterEach(cleanup);

function renderComposer(attachment?: React.ReactNode, picking = false) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const onPickArea = vi.fn();
  const boundary = { current: null as HTMLElement | null };
  render(
    <>
      <button type="button">Halaman</button>
      <div ref={(element) => void (boundary.current = element)}>
        <Composer
          onSubmit={onSubmit}
          onCancel={onCancel}
          onPickArea={onPickArea}
          picking={picking}
          boundary={boundary}
        >
          {attachment}
        </Composer>
        <button type="button">Answer Card</button>
      </div>
    </>,
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

  test("sends from its button once there is a prompt", () => {
    const { input, onSubmit } = renderComposer();
    const send = screen.getByRole("button", { name: "Kirim" });

    expect(send).toHaveProperty("disabled", true);
    fireEvent.change(input, { target: { value: "Mulai dari mana?" } });
    fireEvent.click(send);

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Mulai dari mana?");
  });

  test("starts area select mode from its button without sending", () => {
    const { onPickArea, onSubmit } = renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pilih area" }));

    expect(onPickArea).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("asks Nemu by default", () => {
    const { input } = renderComposer();

    expect(input).toHaveProperty("placeholder", "Tanya Nemu…");
  });

  test("says how to drag a box while area select mode is on", () => {
    const { input } = renderComposer(undefined, true);

    expect(input).toHaveProperty("placeholder", "Seret area di layar · Esc batal");
    expect(screen.getByRole("button", { name: "Pilih area" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  test("asks about the attached part of the page", () => {
    const { input } = renderComposer(
      <AreaCropChip
        state={{ kind: "attached", crop: "data:image/png;base64,AREA" }}
        onRemove={vi.fn()}
      />,
    );

    expect(input).toHaveProperty("placeholder", "Tanya tentang bagian ini…");
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

  test("closes when the page is clicked while it is empty", () => {
    const { input, onCancel } = renderComposer();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Halaman" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("keeps a draft and marks itself when the page is clicked", () => {
    const { input, onCancel } = renderComposer();

    fireEvent.change(input, { target: { value: "Mulai dari mana?" } });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Halaman" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(input).toHaveProperty("value", "Mulai dari mana?");
    expect(input.closest("[data-nudged]")).not.toBeNull();
  });

  test("keeps an attached Area Crop when the page is clicked", () => {
    const { onCancel } = renderComposer(
      <AreaCropChip
        state={{ kind: "attached", crop: "data:image/png;base64,AREA" }}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Halaman" }));

    expect(onCancel).not.toHaveBeenCalled();
  });

  test("stays open when the rest of Nemu, such as the Answer Card, is clicked", () => {
    const { onCancel } = renderComposer();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Answer Card" }));

    expect(onCancel).not.toHaveBeenCalled();
  });
});
