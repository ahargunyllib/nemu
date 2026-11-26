import { type WorkspaceId, isWorkspaceId } from "./workspace-ids";

export type WorkspaceUser = { id: string; role: string; workspaceId: string };

// Admin Javan (`admin`) sees every page; the legacy AlurKerja `verifikator` keeps its full access.
const FULL_ADMIN_ROLES = new Set(["admin", "verifikator"]);
// A school `operator` manages only its own school's knowledge, teachers and contacts.
const WORKSPACE_ADMIN_ROLES = new Set([...FULL_ADMIN_ROLES, "operator"]);

export function requireWorkspaceAdmin(user: WorkspaceUser): string {
  if (!WORKSPACE_ADMIN_ROLES.has(user.role)) {
    throw new Error(`Workspace administrator access is required for user ${user.id}`);
  }
  return user.workspaceId;
}

/** For pages outside a school operator's scope: the school list, the Chat Log, integrations. */
export function requireFullAdmin(user: WorkspaceUser): string {
  if (!FULL_ADMIN_ROLES.has(user.role)) {
    throw new Error(`Admin Javan access is required for user ${user.id}`);
  }
  return user.workspaceId;
}

/** Narrows a session's workspace to one Nemu serves, so nothing downstream casts it. */
export function requireKnownWorkspace(workspaceId: string): WorkspaceId {
  if (!isWorkspaceId(workspaceId)) {
    throw new Error(`Workspace ${workspaceId} is not a Nemu workspace`);
  }
  return workspaceId;
}

export function requireWorkspace<T extends WorkspaceId>(
  actualWorkspaceId: string,
  requiredWorkspaceId: T,
): T {
  if (actualWorkspaceId !== requiredWorkspaceId) {
    throw new Error(`Workspace ${requiredWorkspaceId} access is required`);
  }
  return requiredWorkspaceId;
}
