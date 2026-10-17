import { nemuRequestSchema, nemuResponseSchema } from "@nemu/contracts";

import { protectedProcedure } from "../../index";
import { createProcessInstanceDeps, loadProcessContext } from "../process-instances/service";

export const chatRouter = {
  nemuChat: protectedProcedure.input(nemuRequestSchema).handler(async ({ context, input }) => {
    const authenticatedUserId = context.session.user.id;
    // The process context comes from the Demo App's data, never from the extension.
    const processContext = await loadProcessContext(
      createProcessInstanceDeps(context.db),
      authenticatedUserId,
    );
    const response = await context.nemu.respond(
      { ...input, user_id: authenticatedUserId, process_context: processContext },
      authenticatedUserId,
    );
    return nemuResponseSchema.parse(response);
  }),
};
