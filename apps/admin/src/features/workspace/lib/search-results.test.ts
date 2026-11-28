import { describe, expect, test } from "vite-plus/test";

import { documentResults, matchesSearch, stepResults } from "./search-results";

const SOP = {
  id: "sop",
  title: "SOP Penilaian SDIT Nusantara",
  fileName: "sop.pdf",
  format: "pdf" as const,
  status: "ready" as const,
};
const TAHFIDZ = {
  id: "tahfidz",
  title: "Catat Hafalan Tahfidz",
  fileName: "tahfidz.bpmn",
  format: "bpmn" as const,
  status: "ready" as const,
};

describe("top bar search", () => {
  test("matches every typed word as written, not letters scattered through a title", () => {
    const [step] = stepResults(TAHFIDZ, [
      { elementId: "Task_Setoran", kind: "task", name: "Isi setoran satu kelas" },
    ]);
    expect(step && matchesSearch(step.keywords, "Setoran kelas")).toBe(true);
    expect(step && matchesSearch(step.keywords, "tahfidz")).toBe(true);
    const [sop] = documentResults([SOP]);
    // "oran" is scattered through "SOP Penilaian SDIT Nusantara" but is not a word in it.
    expect(sop && matchesSearch(sop.keywords, "oran")).toBe(false);
  });

  test("opens a read BPMN and its steps as the diagram, anything else in Dokumen dan alur", () => {
    const failed = { ...TAHFIDZ, id: "broken", status: "failed" as const };
    expect(documentResults([SOP, TAHFIDZ, failed]).map((r) => [r.group, r.target])).toEqual([
      ["Dokumen", { to: "/documents", search: { cari: SOP.title } }],
      ["Alur", { to: "/process-diagram", search: { document: "tahfidz" } }],
      ["Alur", { to: "/documents", search: { cari: TAHFIDZ.title } }],
    ]);
    expect(
      stepResults(TAHFIDZ, [
        { elementId: "Task_Setoran", kind: "task", name: "Isi setoran satu kelas" },
        { elementId: "Flow_unnamed", kind: "event", name: " " },
      ]).map((r) => r.target),
    ).toEqual([{ to: "/process-diagram", search: { document: "tahfidz", path: "Task_Setoran" } }]);
  });
});
