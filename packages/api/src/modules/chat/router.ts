import { nemuRequestSchema } from "@nemu/contracts";

import type { Context } from "../../context";
import { protectedProcedure, workspaceAdminProcedure } from "../../index";
import { createChatProcessContextDeps } from "./process-context-deps";
import { createChatLogRepository } from "./repository";
import { answerNemuChat, listChatLog } from "./service";

function chatDeps(context: Pick<Context, "db" | "nemu">) {
  return { nemu: context.nemu, chatLog: createChatLogRepository(context.db) };
}

export const chatRouter = {
  nemuChat: protectedProcedure
    .input(nemuRequestSchema)
    .handler(({ context, input }) =>
      answerNemuChat(
        { ...chatDeps(context), processContexts: createChatProcessContextDeps(context.db) },
        input,
        { id: context.session.user.id, workspaceId: context.session.user.workspaceId },
      ),
    ),

  listChatLog: workspaceAdminProcedure.handler(({ context }) =>
    listChatLog(chatDeps(context), context.session.user.workspaceId),
  ),
};
