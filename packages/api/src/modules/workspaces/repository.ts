import { type Database, eq } from "@nemu/db";
import { workspace } from "@nemu/db/schema/workspace";

export type WorkspaceRepository = {
  findDemoDate(workspaceId: string): Promise<string | undefined>;
};

export function createWorkspaceRepository(db: Database): WorkspaceRepository {
  return {
    async findDemoDate(workspaceId) {
      const [record] = await db
        .select({ demoDate: workspace.demoDate })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1);
      return record?.demoDate;
    },
  };
}
