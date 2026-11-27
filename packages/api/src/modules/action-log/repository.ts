import type { ActionLogEntry } from "@nemu/contracts/executor";
import type { Database } from "@nemu/db";
import { actionLog } from "@nemu/db/schema/action-log";

export type ActionLogAuthor = { workspaceId: string; teacherId: string; teacherName: string };

/** WS-10 storage: the executor's actions, one row each. */
export async function insertActionLog(
  db: Database,
  author: ActionLogAuthor,
  entries: readonly ActionLogEntry[],
): Promise<void> {
  await db.insert(actionLog).values(
    entries.map((entry) => ({
      id: crypto.randomUUID(),
      ...author,
      actedAt: new Date(entry.at),
      website: entry.website,
      task: entry.task,
      action: entry.action,
      target: entry.target,
      cara: entry.cara,
      result: entry.result,
    })),
  );
}
