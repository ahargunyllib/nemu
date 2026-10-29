// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

import UpNextCard from "./up-next-card";

// A fake Nemu Service behind the real oRPC query utils: the seeded Pertanggungjawaban Task, back
// 5 November and due on its batas pertanggungjawaban, and a Revisi Task already past its due day.
vi.mock("@/shared/api/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      async getDemoClock() {
        return { today: "2026-11-06" };
      },
      async listMyTasks(): Promise<ProcessInstanceView[]> {
        return [
          instance("PD-2026-0042", {
            id: "PJ-PD-2026-0042",
            key: "pertanggungjawaban",
            label: "Pertanggungjawaban",
            openedOn: "2026-11-05",
            dueOn: "2026-11-12",
          }),
          instance("PD-2026-0043", {
            id: "RV-PD-2026-0043",
            key: "revisi",
            label: "Perbaiki pengajuan",
            openedOn: "2026-10-28",
            dueOn: "2026-11-04",
          }),
        ];
      },
    }),
  };
});

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
    updatedAt: new Date("2026-10-18"),
    activeTask,
    dokumen: [],
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UpNextCard", () => {
  test("counts days left from the demo clock, not the browser's", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const router = createRouter({
      routeTree: createRootRoute({ component: UpNextCard }),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const pertanggungjawaban = await screen.findByRole("link", {
      name: "Pertanggungjawaban PD-2026-0042",
    });
    expect(pertanggungjawaban.textContent).toContain("12 Nov");
    expect(pertanggungjawaban.textContent).not.toContain("Terlambat");
    expect(
      screen.getByRole("link", { name: "Perbaiki pengajuan PD-2026-0043" }).textContent,
    ).toContain("Terlambat 2 hari");
  });
});
