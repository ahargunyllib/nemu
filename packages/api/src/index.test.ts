import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { Context } from "./context";
import { protectedProcedure, travelAdminProcedure, workspaceAdminProcedure } from "./index";

function contextFor(role: string, workspaceId: string): Context {
  return { session: { session: {}, user: { id: "user", role, workspaceId } } } as Context;
}

const whoAmI = protectedProcedure.handler(({ context }) => context.session.user.workspaceId);

describe("protectedProcedure", () => {
  it("hands the handler a session workspace Nemu serves", async () => {
    await expect(
      call(whoAmI, undefined, { context: contextFor("pegawai", "W-TELKO") }),
    ).resolves.toBe("W-TELKO");
  });

  it("rejects a session whose workspace Nemu doesn't serve", async () => {
    await expect(
      call(whoAmI, undefined, { context: contextFor("pegawai", "W-UNKNOWN") }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Workspace W-UNKNOWN is not a Nemu workspace",
    });
  });

  it("rejects a request without a session", async () => {
    await expect(
      call(whoAmI, undefined, { context: { session: null } as Context }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("workspaceAdminProcedure", () => {
  it("validates the administrator's workspace too", async () => {
    const adminWorkspace = workspaceAdminProcedure.handler(
      ({ context }) => context.session.user.workspaceId,
    );

    await expect(
      call(adminWorkspace, undefined, { context: contextFor("verifikator", "W-UNKNOWN") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("travelAdminProcedure", () => {
  it("keeps the travel Reference Tables to W-TRAVEL administrators", async () => {
    const tables = travelAdminProcedure.handler(() => "reached");

    await expect(
      call(tables, undefined, { context: contextFor("operator", "W-SEKOLAH") }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Workspace W-TRAVEL access is required",
    });
    await expect(
      call(tables, undefined, { context: contextFor("verifikator", "W-TRAVEL") }),
    ).resolves.toBe("reached");
  });
});
