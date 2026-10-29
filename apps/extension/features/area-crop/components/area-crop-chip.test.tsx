// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AreaCropChip } from "./area-crop-chip";

afterEach(cleanup);

describe("AreaCropChip", () => {
  test("tells Rina to open Nemu from the toolbar when the tab can't be captured", () => {
    render(<AreaCropChip state={{ kind: "failed", reason: "no-tab-access" }} onRemove={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Area belum bisa diambil di tab ini.");
    expect(alert.textContent).toContain(
      "Buka Nemu dari ikon Nemu di toolbar atau Ctrl+Shift+Space, lalu pilih area lagi.",
    );
  });

  test("asks Rina to select again when the capture failed for another reason", () => {
    render(<AreaCropChip state={{ kind: "failed", reason: "unknown" }} onRemove={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toBe("Area gagal diambil. Coba pilih lagi.");
  });
});
