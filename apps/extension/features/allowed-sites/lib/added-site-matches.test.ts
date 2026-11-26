import { describe, expect, test } from "vite-plus/test";

import { addedSiteMatches } from "./added-site-matches";

describe("addedSiteMatches", () => {
  test("keeps only the sites granted after install", () => {
    expect(
      addedSiteMatches(
        [
          "https://*.alursekolah.id/*",
          "http://localhost/*",
          "https://nemu-api.ahargunyllib.dev/*",
          "https://portal.sekolah.sch.id/*",
          "https://portal.sekolah.sch.id/*",
        ],
        ["https://*.alursekolah.id/*", "http://localhost/*"],
        "https://nemu-api.ahargunyllib.dev",
      ),
    ).toEqual(["https://portal.sekolah.sch.id/*"]);
  });
});
