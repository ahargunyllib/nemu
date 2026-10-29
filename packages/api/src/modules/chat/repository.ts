import { type Database, desc, eq, getColumns } from "@nemu/db";
import { user } from "@nemu/db/schema/auth";
import { chatLog } from "@nemu/db/schema/chat-log";

export type ChatLogRecord = typeof chatLog.$inferSelect;
export type NewChatLogRecord = typeof chatLog.$inferInsert;
export type ChatLogEntry = ChatLogRecord & { user: { name: string; email: string } | null };

export type ChatLogRepository = {
  insert(record: NewChatLogRecord): Promise<void>;
  listNewest(limit: number, workspaceId: string): Promise<ChatLogEntry[]>;
};

export function createChatLogRepository(db: Database): ChatLogRepository {
  return {
    async insert(record) {
      await db.insert(chatLog).values(record);
    },
    listNewest(limit, workspaceId) {
      return db
        .select({
          ...getColumns(chatLog),
          user: { name: user.name, email: user.email },
        })
        .from(chatLog)
        .leftJoin(user, eq(chatLog.userId, user.id))
        .where(eq(user.workspaceId, workspaceId))
        .orderBy(desc(chatLog.createdAt))
        .limit(limit);
    },
  };
}
