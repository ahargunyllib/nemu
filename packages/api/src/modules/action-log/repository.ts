import type { ActionLogEntry } from "@nemu/contracts/executor";
import { type Database, desc, eq } from "@nemu/db";
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

/** How many actions WS-10 shows: the newest ones, enough for a demo day without paging. */
export const ACTION_LOG_PAGE = 500;

/** WS-10: the school's newest actions first, without filters. */
export function listActionLog(db: Database, workspaceId: string) {
  return db
    .select({
      id: actionLog.id,
      teacherName: actionLog.teacherName,
      actedAt: actionLog.actedAt,
      website: actionLog.website,
      task: actionLog.task,
      action: actionLog.action,
      target: actionLog.target,
      cara: actionLog.cara,
      result: actionLog.result,
    })
    .from(actionLog)
    .where(eq(actionLog.workspaceId, workspaceId))
    .orderBy(desc(actionLog.actedAt), desc(actionLog.createdAt))
    .limit(ACTION_LOG_PAGE);
}
