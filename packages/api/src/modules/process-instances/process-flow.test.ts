import { PROCESS_STATES, type ProcessState } from "@nemu/contracts/process-instance";
import { describe, expect, it } from "vite-plus/test";

import { activeTaskOf, nextState, nightsBetween } from "./process-flow";

describe("activeTaskOf", () => {
  it("asks the employee for work only in Draf, Revisi, and Pertanggungjawaban", () => {
    const tasks = PROCESS_STATES.map((state) => [
      state,
      activeTaskOf({ id: "PD-2026-0042", state }),
    ]);

    expect(Object.fromEntries(tasks)).toEqual({
      Draf: { id: "RN-PD-2026-0042", key: "isi_rencana", label: "Isi rencana perjalanan" },
      Diajukan: null,
      Disetujui: null,
      Berangkat: null,
      Kembali: null,
      Pertanggungjawaban: {
        id: "PJ-PD-2026-0042",
        key: "pertanggungjawaban",
        label: "Pertanggungjawaban",
      },
      Verifikasi: null,
      Selesai: null,
      Revisi: { id: "RV-PD-2026-0042", key: "revisi", label: "Perbaiki pengajuan" },
    });
  });
});

describe("nextState", () => {
  it("walks the trip from Draf to Selesai, sends a Revisi back to Diajukan, and stops at Selesai", () => {
    const walk: ProcessState[] = ["Draf"];
    for (let state = nextState("Draf"); state; state = nextState(state)) walk.push(state);

    expect(walk).toEqual([
      "Draf",
      "Diajukan",
      "Disetujui",
      "Berangkat",
      "Kembali",
      "Pertanggungjawaban",
      "Verifikasi",
      "Selesai",
    ]);
    expect(nextState("Revisi")).toBe("Diajukan");
  });
});

describe("nightsBetween", () => {
  it("counts 3–5 November as 2 nights", () => {
    expect(nightsBetween("2026-11-03", "2026-11-05")).toBe(2);
  });
});
