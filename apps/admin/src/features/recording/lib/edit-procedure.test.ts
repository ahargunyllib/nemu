import type { Procedure } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { deleteStep, renameParameter, valueText } from "./edit-procedure";

const locator = {
  role: null,
  name: null,
  label: null,
  placeholder: null,
  css: null,
  relX: null,
  relY: null,
};
const PROCEDURE: Procedure = {
  title: "Catat ujian tahfidz",
  recordedBy: "Pak Rizal",
  parameters: [
    { name: "kelas", label: "Kelas", question: "Kelas apa?", example: "4A" },
    { name: "murid", label: "Murid", question: "Murid apa?", example: "Aisyah" },
  ],
  steps: [
    {
      id: "step-1",
      order: 1,
      action: "select",
      locator,
      urlPattern: "",
      valueTemplate: "{{kelas}}",
      instruction: "",
      requiresHumanAction: false,
    },
    {
      id: "step-2",
      order: 2,
      action: "select",
      locator,
      urlPattern: "",
      valueTemplate: "{{murid}}",
      instruction: "",
      requiresHumanAction: false,
    },
    {
      id: "step-3",
      order: 3,
      action: "click",
      locator,
      urlPattern: "",
      valueTemplate: null,
      instruction: "",
      requiresHumanAction: true,
    },
  ],
};

describe("reviewing a recording (F3-02)", () => {
  test("deleting a step renumbers the rest and drops its now-unused input", () => {
    const edited = deleteStep(PROCEDURE, "step-2");
    expect(edited.steps.map((step) => [step.id, step.order])).toEqual([
      ["step-1", 1],
      ["step-2", 2],
    ]);
    expect(edited.parameters.map((parameter) => parameter.name)).toEqual(["kelas"]);
  });

  test("renaming an input changes what the step list and Nemu's question say", () => {
    const edited = renameParameter(PROCEDURE, "murid", {
      label: "Nama murid",
      question: "Murid siapa?",
    });
    expect(valueText(edited, "{{murid}}")).toBe("‹Nama murid›");
    expect(edited.parameters[1]).toMatchObject({ label: "Nama murid", question: "Murid siapa?" });
  });
});
