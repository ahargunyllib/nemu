import { describe, expect, it } from "vite-plus/test";

import { requireWorkspace, requireWorkspaceAdmin } from "./authorization";

describe("requireWorkspaceAdmin", () => {
  it("returns the authenticated workspace for an administrator", () => {
    expect(
      requireWorkspaceAdmin({ id: "verifikator", role: "verifikator", workspaceId: "W-TRAVEL" }),
    ).toBe("W-TRAVEL");
  });

  it("rejects ordinary and Billing Liaison demo accounts", () => {
    expect(() =>
      requireWorkspaceAdmin({ id: "rina", role: "pegawai", workspaceId: "W-TRAVEL" }),
    ).toThrow("Workspace administrator access is required");
    expect(() =>
      requireWorkspaceAdmin({ id: "U-101", role: "billing_liaison", workspaceId: "W-TELKO" }),
    ).toThrow("Workspace administrator access is required");
  });
});

describe("requireWorkspace", () => {
  it("rejects access to another workspace's global reference data", () => {
    expect(() => requireWorkspace("W-TELKO", "W-TRAVEL")).toThrow(
      "Workspace W-TRAVEL access is required",
    );
    expect(requireWorkspace("W-TRAVEL", "W-TRAVEL")).toBe("W-TRAVEL");
  });
});
