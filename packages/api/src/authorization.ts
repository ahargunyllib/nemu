import { type WorkspaceId, isWorkspaceId } from "./workspace-ids";

export type WorkspaceUser = { id: string; role: string; workspaceId: string };

const WORKSPACE_ADMIN_ROLES = new Set(["admin", "verifikator"]);

export function requireWorkspaceAdmin(user: WorkspaceUser): string {
  if (!WORKSPACE_ADMIN_ROLES.has(user.role)) {
    throw new Error(`Workspace administrator access is required for user ${user.id}`);
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
