import { orderChoices } from "@nemu/ui/lib/nemu-display";
import { describe, expect, test, vi } from "vite-plus/test";

import { warningCard } from "./warning";

describe("the F4-06 warning (F4-3)", () => {
  test("says the count word for word, with Jangan hapus first and ⚠ on the second choice", () => {
    const card = warningCard(3, "Latihan: My Family (has/have)", () => undefined);
    // A red HATI-HATI heading with the quiz's name on the right (docs/design-system.md).
    expect(card.status).toEqual({
      tone: "warning",
      text: "Hati-hati",
      count: "Latihan: My Family (has/have)",
    });
    expect(card.question).toBe(
      "Kuis ini sudah dikerjakan 3 siswa. Kalau dihapus, nilainya ikut terhapus.",
    );
    expect(orderChoices(card.choices)).toEqual([
      { id: "jangan", label: "Jangan hapus" },
      { id: "tunjukkan", label: "Tunjukkan tombol Hapus", risky: true },
    ]);
  });

  test("a quiz nobody took gets no grade warning, and the choices stay the same", () => {
    const card = warningCard(0, "Latihan: My Family (has/have)", () => undefined);
    expect(card.question).toBe("Kuis ini belum dikerjakan siswa.");
    expect(card.choices.map((choice) => choice.label)).toEqual([
      "Jangan hapus",
      "Tunjukkan tombol Hapus",
    ]);
  });

  test("passes her choice on", () => {
    const chosen = vi.fn();
    const card = warningCard(3, "Latihan: My Family (has/have)", chosen);
    card.onChoose("tunjukkan");
    card.onChoose("jangan");
    expect(chosen.mock.calls).toEqual([["tunjukkan"], ["jangan"]]);
  });
});
