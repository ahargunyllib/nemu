import { describe, expect, test } from "vite-plus/test";

import { siteAccessFor } from "./site-access";

const CONFIG = {
  schoolName: "SDIT Nusantara",
  fetchedAt: 0,
  allowedSites: [
    { pattern: "localhost:3003", label: "AlurSekolah (tiruan)", permission: "read_fill" as const },
    { pattern: "localhost:3004", label: "Ruang GTK (tiruan)", permission: "read_only" as const },
  ],
  settings: {
    talkShortcut: "Alt+Shift+N",
    defaultCara: "tunjuk" as const,
    fillSpeed: "pelan" as const,
  },
};

describe("siteAccessFor", () => {
  test("gives a listed page its permission and the school's settings", () => {
    expect(siteAccessFor(CONFIG, "http://localhost:3004/kinerja")).toEqual({
      permission: "read_only",
      settings: CONFIG.settings,
    });
  });

  test("gives nothing off the list, and defaults when a cached config has no settings", () => {
    expect(siteAccessFor(CONFIG, "http://localhost:3005/")).toBeNull();
    const { settings: _settings, ...cached } = CONFIG;
    expect(siteAccessFor(cached, "http://localhost:3003/")?.settings).toEqual({
      talkShortcut: "Ctrl+Space",
      defaultCara: "isi",
      fillSpeed: "normal",
    });
  });
});
