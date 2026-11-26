import { describe, expect, it } from "vite-plus/test";

import {
  requireFullAdmin,
  requireKnownWorkspace,
  requireWorkspace,
  requireWorkspaceAdmin,
} from "./authorization";

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

describe("school roles", () => {
  const operator = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
  const adminJavan = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };

  it("lets a school operator administer its own workspace", () => {
    expect(requireWorkspaceAdmin(operator)).toBe("W-SEKOLAH");
  });

  it("keeps Admin Javan's pages from the operator and from teachers", () => {
    expect(requireFullAdmin(adminJavan)).toBe("W-SEKOLAH");
    expect(() => requireFullAdmin(operator)).toThrow("Admin Javan access is required");
    expect(() => requireFullAdmin({ id: "siti", role: "guru", workspaceId: "W-SEKOLAH" })).toThrow(
      "Admin Javan access is required",
    );
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

describe("requireKnownWorkspace", () => {
  it("accepts the workspaces Nemu serves and rejects any other value", () => {
    expect(requireKnownWorkspace("W-TRAVEL")).toBe("W-TRAVEL");
    expect(requireKnownWorkspace("W-TELKO")).toBe("W-TELKO");
    expect(() => requireKnownWorkspace("W-TEST")).toThrow(
      "Workspace W-TEST is not a Nemu workspace",
    );
  });
});
