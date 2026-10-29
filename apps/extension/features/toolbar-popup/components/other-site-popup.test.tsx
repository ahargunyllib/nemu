// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { OtherSitePopup } from "./other-site-popup";

afterEach(cleanup);

describe("OtherSitePopup", () => {
  test("says Nemu works on AlurKerja and opens it", () => {
    const onOpenApp = vi.fn();
    render(<OtherSitePopup onOpenApp={onOpenApp} />);

    expect(screen.getByRole("heading", { name: "Nemu aktif di AlurKerja" })).toBeTruthy();
    expect(
      screen.getByText(
        "Di situs ini Nemu tidak membaca apa pun. Buka AlurKerja untuk bertanya soal proses kerja.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buka AlurKerja" }));

    expect(onOpenApp).toHaveBeenCalledOnce();
  });
});
