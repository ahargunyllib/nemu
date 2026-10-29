import { ORPCError, call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { Context } from "../../context";
import { processInstancesRouter } from "./router";

// Any query fails loudly, so a test can tell whether a call got past the gate.
const unreachableDb = new Proxy(
  {},
  {
    get() {
      throw new Error("reached the database");
    },
  },
) as Context["db"];

function contextFor(id: string, workspaceId: string): Context {
  return {
    session: { session: {}, user: { id, role: "pegawai", workspaceId } },
    db: unreachableDb,
    nemu: { respond: async () => Promise.reject(new Error("unused")) },
    documentFiles: { put: async () => {}, get: async () => null, delete: async () => {} },
    demoDate: "2026-11-06",
  } as unknown as Context;
}

const dimas = contextFor("U-101", "W-TELKO");
const rina = contextFor("rina", "W-TRAVEL");

const TRAVEL_CALLS = {
  ajukanPerjalananDinas: {},
  listMyProcessInstances: undefined,
  listMyTasks: undefined,
  getProcessInstance: { instanceId: "PD-2026-0001" },
  unggahDokumenPertanggungjawaban: {},
  kirimPertanggungjawaban: { instanceId: "PD-2026-0001" },
  majukanState: { instanceId: "PD-2026-0001" },
} as const;

describe("processInstancesRouter workspace gate", () => {
  it.each(Object.entries(TRAVEL_CALLS))(
    "rejects a W-TELKO user on %s before touching travel data",
    async (name, input) => {
      const procedure = processInstancesRouter[name as keyof typeof TRAVEL_CALLS];
      const error = await call(procedure as never, input, { context: dimas }).catch((e) => e);

      expect(error).toBeInstanceOf(ORPCError);
      expect(error).toMatchObject({
        code: "FORBIDDEN",
        message: "Workspace W-TRAVEL access is required",
      });
    },
  );

  it("lets a W-TRAVEL user through to the travel data", async () => {
    await expect(
      call(processInstancesRouter.listMyProcessInstances, undefined, { context: rina }),
    ).rejects.toThrow("reached the database");
  });

  it("keeps the demo clock open to every workspace", async () => {
    await expect(
      call(processInstancesRouter.getDemoClock, undefined, { context: dimas }),
    ).resolves.toEqual({ today: "2026-11-06" });
  });
});
