import { nemuRequestSchema, nemuResponseSchema } from "@nemu/contracts";

import { protectedProcedure } from "../../index";

export const chatRouter = {
  nemuChat: protectedProcedure.input(nemuRequestSchema).handler(async ({ context, input }) => {
    const authenticatedUserId = context.session.user.id;
    const response = await context.nemu.respond(
      { ...input, user_id: authenticatedUserId },
      authenticatedUserId,
    );
    return nemuResponseSchema.parse(response);
  }),
};
