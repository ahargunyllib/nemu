import { describe, expect, test } from "vite-plus/test";

import { executorSettings } from "./executor-settings";

const SITES = [
  { pattern: "localhost:3003", label: "AlurSekolah (tiruan)", permission: "read_fill" as const },
  { pattern: "localhost:3004", label: "Ruang GTK (tiruan)", permission: "read_only" as const },
  { pattern: "web.whatsapp.com", label: "WhatsApp", permission: "prepare_message" as const },
];

function config(settings?: {
  talkShortcut: string;
  defaultCara: "isi" | "tunjuk" | "cek";
  fillSpeed: "pelan" | "normal" | "cepat";
}) {
  return { schoolName: "SDIT Nusantara", allowedSites: SITES, fetchedAt: 0, settings };
}

describe("executorSettings", () => {
  test("takes the school's WS-08 default cara and fill speed", () => {
    expect(
      executorSettings(
        config({ talkShortcut: "Ctrl+Space", defaultCara: "tunjuk", fillSpeed: "pelan" }),
        "http://localhost:3003/#/nilai",
      ),
    ).toMatchObject({ cara: 2, fieldsPerSecond: 0.5, permission: "read_fill" });
    expect(
      executorSettings(
        config({ talkShortcut: "Ctrl+Space", defaultCara: "cek", fillSpeed: "cepat" }),
        "http://localhost:3003/",
      ),
    ).toMatchObject({ cara: 3, fieldsPerSecond: 2 });
  });

  test("knows the school's talk combination, so holding it doesn't stop Nemu", () => {
    expect(
      executorSettings(
        config({ talkShortcut: "Alt+Shift+N", defaultCara: "isi", fillSpeed: "normal" }),
        "http://localhost:3003/",
      ).talkShortcut,
    ).toEqual({ ctrl: false, alt: true, shift: true, meta: false, code: "KeyN" });
  });

  test("takes the page's WS-03 permission", () => {
    expect(executorSettings(config(), "http://localhost:3004/kinerja").permission).toBe(
      "read_only",
    );
    expect(executorSettings(config(), "https://web.whatsapp.com/").permission).toBe(
      "prepare_message",
    );
  });

  test("falls back to cara 1 at one field a second for a config cached before WS-08", () => {
    expect(executorSettings(config(), "http://localhost:3003/")).toMatchObject({
      cara: 1,
      fieldsPerSecond: 1,
      permission: "read_fill",
    });
    expect(executorSettings(null)).toMatchObject({ cara: 1, fieldsPerSecond: 1 });
  });
});
