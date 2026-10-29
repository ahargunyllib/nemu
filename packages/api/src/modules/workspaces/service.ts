import type { WorkspaceRepository } from "./repository";

/** The workspace-owned demo date (YYYY-MM-DD), or `fallback` for a workspace with no row. */
export async function getDemoDate(
  workspaces: WorkspaceRepository,
  workspaceId: string,
  fallback: string,
): Promise<string> {
  return (await workspaces.findDemoDate(workspaceId)) ?? fallback;
}
