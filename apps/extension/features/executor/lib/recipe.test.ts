import { describe, expect, test } from "vite-plus/test";

import { recipeCard, recipeName } from "./recipe";

describe("step notes as a checked recipe (F3·08)", () => {
  test("a read-back that matches is Sudah dicek, with the recipe named after the task", () => {
    expect(
      recipeCard({
        checked: { ok: true, title: "Setoran 3 murid tersimpan, sama dengan buku." },
        detail: "Foto dihapus dari Nemu.",
        recipe: "Catat Hafalan Tahfidz",
      }),
    ).toEqual({
      status: { tone: "success", text: "Sudah dicek" },
      title: "Setoran 3 murid tersimpan, sama dengan buku.",
      detail: "Foto dihapus dari Nemu.",
      itemsLabel: "Catatan langkah · Cara catat hafalan tahfidz",
    });
  });

  test("one that doesn't match says so in red", () => {
    const card = recipeCard({
      checked: { ok: false, title: "Setoran tersimpan, tapi 1 dari 3 murid belum sama." },
      recipe: "Catat setoran",
    });
    expect(card.status).toEqual({ tone: "danger", text: "Belum sama" });
    expect(card).not.toHaveProperty("detail");
    expect(recipeName(" Pasang Kuis ")).toBe("Cara pasang kuis");
  });
});
