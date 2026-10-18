// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { ReadingPill } from "./reading-pill";

afterEach(cleanup);

describe("ReadingPill", () => {
  test("says Nemu is reading, with no buttons", () => {
    render(<ReadingPill />);

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Membaca halaman dan SOP…");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
