import { describe, expect, test } from "vite-plus/test";

import { canOpen, navGroupsFor } from "./nav-items";

// Sorted, so the test is about who sees a page and not where the menu puts it.
const pagesFor = (role: string) =>
  navGroupsFor(role)
    .flatMap((group) => group.items.map((item) => item.to))
    .sort();

describe("what a school operator sees (ADR-0022)", () => {
  test("Ringkasan, its school's pages, allowed websites, integrations and the action log", () => {
    expect(pagesFor("operator")).toEqual([
      "/action-log",
      "/dashboard",
      "/documents",
      "/integrations",
      "/kamus",
      "/sites",
      "/teachers",
      "/try-answer",
    ]);
    for (const path of ["/dashboard", "/sites", "/integrations", "/action-log"]) {
      expect(canOpen("operator", path)).toBe(true);
    }
  });

  test("not the school list, the package, Tables or Pengaturan Nemu, which Admin Javan keeps", () => {
    for (const path of ["/schools", "/package", "/tables", "/settings"]) {
      expect(canOpen("operator", path)).toBe(false);
      expect(canOpen("admin", path)).toBe(true);
    }
  });
});
