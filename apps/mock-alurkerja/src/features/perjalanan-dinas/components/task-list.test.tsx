// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

import TaskList from "./task-list";

function instance(
  id: string,
  activeTask: NonNullable<ProcessInstanceView["activeTask"]>,
): ProcessInstanceView {
  return {
    id,
    ownerId: "rina",
    state: activeTask.key === "pertanggungjawaban" ? "Pertanggungjawaban" : "Revisi",
    jenisPerjalanan: "Perjalanan dinas luar kota",
    nomorSuratTugas: "ST-123/BLD/2026",
    kotaTujuan: "Makassar",
    provinsi: "Sulawesi Selatan",
    maksud: "Rapat koordinasi layanan digital",
    tanggalBerangkat: "2026-11-03",
    tanggalKembali: "2026-11-05",
    modaTransport: "Pesawat",
    biayaTransport: 3_500_000,
    penginapan: "tidak_hotel",
    nominalPenginapan: 447_000,
    uangHarian: 1_290_000,
    dokumenUndangan: "undangan-rapat-koordinasi.pdf",
    createdAt: new Date("2026-10-27"),
    updatedAt: new Date("2026-11-06"),
    activeTask,
    dokumen: [],
  };
}

const TASKS = [
  instance("PD-2026-0042", {
    id: "PJ-PD-2026-0042",
    key: "pertanggungjawaban",
    label: "Pertanggungjawaban",
  }),
  instance("PD-2026-0043", { id: "RV-PD-2026-0043", key: "revisi", label: "Revisi pengajuan" }),
];

async function renderTaskList() {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <TaskList tasks={TASKS} /> }),
    history: createMemoryHistory({ initialEntries: ["/my-task"] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole("searchbox", { name: "Search tasks" });
}

afterEach(cleanup);

describe("TaskList", () => {
  test("each row opens its task page under its Task's nemu_id", async () => {
    await renderTaskList();

    const row = screen.getByRole("link", { name: "Pertanggungjawaban PD-2026-0042" });
    expect(row.getAttribute("href")).toBe("/perdin/task/PD-2026-0042");
    expect(row.getAttribute("data-nemu-id")).toBe(NEMU_IDS.task.pertanggungjawaban);
  });

  test("search narrows the rows by Task ID and says when nothing matches", async () => {
    const search = await renderTaskList();

    fireEvent.change(search, { target: { value: "rv-pd" } });
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Revisi pengajuan PD-2026-0043",
    ]);

    fireEvent.change(search, { target: { value: "cuti" } });
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getByText("Tidak ada tugas yang cocok")).toBeTruthy();
  });
});
