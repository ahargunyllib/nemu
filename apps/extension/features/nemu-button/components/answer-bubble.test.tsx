// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AnswerBubble } from "./answer-bubble";

afterEach(cleanup);

describe("AnswerBubble", () => {
  test("shows the answer with its sources and closes", () => {
    const onClose = vi.fn();
    render(
      <AnswerBubble
        text="KKM seluruh mata pelajaran adalah 75."
        sources={["SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2"]}
        onClose={onClose}
      />,
    );
    const bubble = screen.getByRole("region", { name: "Jawaban Nemu" });
    expect(bubble.textContent).toContain("KKM seluruh mata pelajaran adalah 75.");
    expect(screen.getByText("SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
