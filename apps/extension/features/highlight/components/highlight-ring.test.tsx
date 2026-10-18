// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { jenisPerjalananStep } from "../../guided-steps/lib/guided-fixtures";
import { HighlightRing } from "./highlight-ring";

const BOX = { left: 40, top: 300, width: 200, height: 32 };

afterEach(cleanup);

/** The label pill's text, without the whitespace inside the mascot's inline SVG. */
function labelText(container: HTMLElement) {
  return container.querySelector('[data-slot="badge"]')?.textContent?.replace(/\s+/g, " ").trim();
}

describe("HighlightRing", () => {
  test("a guided step's label adds its place in the guide", () => {
    const { container } = render(
      <HighlightRing box={BOX} action={jenisPerjalananStep} step={{ index: 0, total: 3 }} />,
    );

    expect(labelText(container)).toBe("Pilih Dinas luar kota · langkah 1/3");
  });

  test("a label outside guided steps has no step count", () => {
    const { container } = render(<HighlightRing box={BOX} action={jenisPerjalananStep} />);

    expect(labelText(container)).toBe("Pilih Dinas luar kota");
  });
});
