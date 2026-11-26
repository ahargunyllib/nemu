import { describe, expect, test } from "vite-plus/test";

import { matchShortCommand } from "./short-commands";

describe("matchShortCommand", () => {
  test.each([
    ["pelan", "pelan"],
    ["Pelan-pelan, Nemu.", "pelan"],
    ["Ulangi.", "ulangi"],
    ["Nemu, tolong ulangi lagi ya", "ulangi"],
    ["sekali lagi", "ulangi"],
    ["Ajari saya", "ajari_saya"],
    ["ajarin saya dong", "ajari_saya"],
    ["Lanjut", "lanjut"],
    ["lanjutkan saja", "lanjut"],
    ["Berhenti!", "berhenti"],
    ["stop", "berhenti"],
    ["sudah dulu", "berhenti"],
  ])("“%s” is %s", (utterance, command) => {
    expect(matchShortCommand(utterance)).toBe(command);
  });

  test.each([
    "ulangi pertanyaan saya tentang KKM",
    "KKM berapa?",
    "masukkan nilai UTS Matematika 4B",
    "",
    "nemu",
  ])("“%s” is not a short command", (utterance) => {
    expect(matchShortCommand(utterance)).toBeNull();
  });
});
