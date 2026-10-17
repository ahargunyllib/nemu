import { nemuRequestSchema } from "@nemu/contracts";

import type { Context } from "../../context";
import { protectedProcedure } from "../../index";
import { createProcessInstanceDeps, loadProcessContext } from "../process-instances/service";
import { createChatLogRepository } from "./repository";
import { answerChat, listChatLog } from "./service";

function chatDeps(context: Pick<Context, "db" | "nemu">) {
  return { nemu: context.nemu, chatLog: createChatLogRepository(context.db) };
}

export const chatRouter = {
  nemuChat: protectedProcedure.input(nemuRequestSchema).handler(async ({ context, input }) => {
    const userId = context.session.user.id;
    // The process context comes from the Demo App's data, never from the extension.
    const processContext = await loadProcessContext(createProcessInstanceDeps(context.db), userId);
    return answerChat(chatDeps(context), { ...input, process_context: processContext }, userId);
  }),

  listChatLog: protectedProcedure.handler(({ context }) => listChatLog(chatDeps(context))),
};
