export type WorkspaceUser = { id: string; role: string; workspaceId: string };

const WORKSPACE_ADMIN_ROLES = new Set(["admin", "verifikator"]);

export function requireWorkspaceAdmin(user: WorkspaceUser): string {
  if (!WORKSPACE_ADMIN_ROLES.has(user.role)) {
    throw new Error(`Workspace administrator access is required for user ${user.id}`);
  }
  return user.workspaceId;
}

export function requireWorkspace(actualWorkspaceId: string, requiredWorkspaceId: string): string {
  if (actualWorkspaceId !== requiredWorkspaceId) {
    throw new Error(`Workspace ${requiredWorkspaceId} access is required`);
  }
  return actualWorkspaceId;
}
