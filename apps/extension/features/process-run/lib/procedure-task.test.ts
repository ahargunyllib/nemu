import type { Procedure } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { recordCommand } from "../../nemu-button/lib/answer";
import { procedureTask } from "./procedure-task";

const locator = (role: string, name: string) => ({
  role,
  name,
  label: name,
  placeholder: null,
  css: null,
  relX: null,
  relY: null,
});
const step = (
  order: number,
  action: Procedure["steps"][number]["action"],
  role: string,
  name: string,
  value: string | null,
  requiresHumanAction = false,
) => ({
  id: `step-${order}`,
  order,
  action,
  locator: locator(role, name),
  urlPattern: "http://localhost:3003/",
  valueTemplate: null,
  instruction: "",
  requiresHumanAction,
  value,
});

describe("replaying a recording (#214)", () => {
  test("clicks open by name, fields fill by label, and Simpan is pointed at with its source", () => {
    const task = procedureTask({
      title: "Catat ujian tahfidz",
      recordedBy: "Pak Rizal",
      honorific: "Bu",
      steps: [
        step(1, "click", "link", "Al-Quran", null),
        step(2, "select", "combobox", "Kelas", "4A"),
        step(3, "fill", "textbox", "Fashohah", "86"),
        step(4, "click", "button", "Simpan ujian", null, true),
      ],
    });
    expect(task).toEqual({
      kind: "f3-rekaman",
      title: "Catat ujian tahfidz",
      source: "Rekaman Pak Rizal",
      steps: [
        { verb: "clickMenu", target: { text: "Al-Quran", role: "link" } },
        { verb: "selectOption", target: { label: "Kelas", role: "combobox" }, option: "4A" },
        { verb: "setValue", target: { label: "Fashohah", role: "textbox" }, value: "86" },
        {
          verb: "point",
          target: { text: "Simpan ujian", role: "button" },
          sentence: "Silakan Ibu tekan Simpan ujian.",
          sumber: "Rekaman Pak Rizal, langkah 4 dari 4",
        },
      ],
    });
  });

  test("“Rekam cara …” is the extension's own command", () => {
    expect(recordCommand("Rekam cara catat ujian tahfidz.")).toBe("catat ujian tahfidz");
    expect(recordCommand("Nemu, rekam cara")).toBe("");
    expect(recordCommand("catat ujian tahfidz")).toBeNull();
  });
});
