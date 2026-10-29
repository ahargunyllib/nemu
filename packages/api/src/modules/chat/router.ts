import { nemuRequestSchema } from "@nemu/contracts";

import type { Context } from "../../context";
import { protectedProcedure, workspaceAdminProcedure } from "../../index";
import { createProcessInstanceDeps, loadProcessContext } from "../process-instances/service";
import { createSlaClaimRepository } from "../sla-claims/repository";
import { createChatLogRepository } from "./repository";
import { answerChat, listChatLog, resolveChatProcessContext } from "./service";

function chatDeps(context: Pick<Context, "db" | "nemu">) {
  return { nemu: context.nemu, chatLog: createChatLogRepository(context.db) };
}

export const chatRouter = {
  nemuChat: protectedProcedure.input(nemuRequestSchema).handler(async ({ context, input }) => {
    const userId = context.session.user.id;
    const slaClaims = createSlaClaimRepository(context.db);
    // The process context comes from the Demo App's data, never from the extension.
    const processContext = await resolveChatProcessContext(
      {
        loadTravel: () =>
          loadProcessContext(createProcessInstanceDeps(context.db), userId, input.url),
        listSlaTasks: (workspaceId) => slaClaims.listTasks(workspaceId, userId),
        findSlaTaskByService: (workspaceId, actorId, serviceId) =>
          slaClaims.findAssignedTaskByService(workspaceId, actorId, serviceId),
        findSlaTaskByInvoice: (workspaceId, actorId, invoiceId) =>
          slaClaims.findAssignedTaskByInvoice(workspaceId, actorId, invoiceId),
      },
      { id: userId, workspaceId: context.session.user.workspaceId },
      input.url,
    );
    return answerChat(chatDeps(context), { ...input, process_context: processContext }, userId);
  }),

  listChatLog: workspaceAdminProcedure.handler(({ context }) =>
    listChatLog(chatDeps(context), context.session.user.workspaceId),
  ),
};
