import { nemuRequestSchema } from "@nemu/contracts";

import type { Context } from "../../context";
import { protectedProcedure } from "../../index";
import { createChatLogRepository } from "./repository";
import { answerChat, listChatLog } from "./service";

function chatDeps(context: Pick<Context, "db" | "nemu">) {
  return { nemu: context.nemu, chatLog: createChatLogRepository(context.db) };
}

export const chatRouter = {
  nemuChat: protectedProcedure
    .input(nemuRequestSchema)
    .handler(({ context, input }) => answerChat(chatDeps(context), input, context.session.user.id)),

  listChatLog: protectedProcedure.handler(({ context }) => listChatLog(chatDeps(context))),
};
