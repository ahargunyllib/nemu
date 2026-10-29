import { PROCESS_STATES, type ProcessState } from "@nemu/contracts/process-instance";
import { describe, expect, it } from "vite-plus/test";

import { activeTaskOf, nextState, nightsBetween, taskDatesOf } from "./process-flow";

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

describe("taskDatesOf", () => {
  it("opens Pertanggungjawaban on tanggal kembali and makes it due 5 working days later", () => {
    // Back Thursday 5 November: Fri 6, Mon 9, Tue 10, Wed 11, Thu 12.
    expect(
      taskDatesOf("pertanggungjawaban", { tanggalKembali: "2026-11-05" }, "2026-11-06"),
    ).toEqual({ openedOn: "2026-11-05", dueOn: "2026-11-12" });
  });

  it("skips the holidays in kalender libur 2026", () => {
    // Back 22 December: 24 and 25 December are holidays, so the 5th working day is the 31st.
    expect(
      taskDatesOf("pertanggungjawaban", { tanggalKembali: "2026-12-22" }, "2026-11-06").dueOn,
    ).toBe("2026-12-31");
  });

  it("gives the other Tasks a week from the demo clock's day", () => {
    expect(taskDatesOf("revisi", { tanggalKembali: "2026-11-05" }, "2026-11-06")).toEqual({
      openedOn: "2026-11-06",
      dueOn: "2026-11-13",
    });
  });
});
