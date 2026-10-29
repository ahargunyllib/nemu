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

import SlaClaimTaskColumn from "./sla-claim-task-column";

const CLAIMS = [
  {
    id: "KLM-2610-0007",
    customer: "PT Arunika Retail",
    serviceId: "TN-ENT-002",
    period: "2026-09",
  },
  {
    id: "KLM-2610-0011",
    customer: "PT Arunika Retail",
    serviceId: "TN-ENT-003",
    period: "2026-08",
  },
];
const TASKS = [
  {
    id: "T-0007-1",
    claimId: "KLM-2610-0007",
    name: "Registrasi Klaim",
    status: "OPEN",
    reviewDueOn: "2026-10-15",
  },
  {
    id: "T-0011-1",
    claimId: "KLM-2610-0011",
    name: "Surat Penolakan",
    status: "OPEN",
    reviewDueOn: null,
  },
];

async function renderColumn() {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <SlaClaimTaskColumn claims={CLAIMS} tasks={TASKS} />,
    }),
    history: createMemoryHistory({ initialEntries: ["/sla-claims"] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole("searchbox", { name: "Search tasks" });
}

afterEach(cleanup);

describe("SlaClaimTaskColumn", () => {
  test("each row names its Task, claim, customer, service, and period, and opens its sheet", async () => {
    await renderColumn();

    const row = screen.getByRole("link", { name: /Registrasi Klaim · KLM-2610-0007/ });
    expect(row.textContent).toContain("PT Arunika Retail · TN-ENT-002 · Sep 2026");
    expect(row.getAttribute("href")).toBe("/sla-claims/KLM-2610-0007");
    expect(row.getAttribute("data-nemu-id")).toBe(NEMU_IDS.slaClaim.taskKlm26100007);
  });

  test("search narrows the rows by Task or claim and says when nothing matches", async () => {
    const search = await renderColumn();

    fireEvent.change(search, { target: { value: "penolakan" } });
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/sla-claims/KLM-2610-0011",
    ]);

    fireEvent.change(search, { target: { value: "klm-2610-0009" } });
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getByText("Tidak ada tugas yang cocok")).toBeTruthy();
  });
});
