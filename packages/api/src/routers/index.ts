import type { RouterClient } from "@orpc/server";
import { nemuRequestSchema, nemuResponseSchema } from "@nemu/contracts";

import { protectedProcedure, publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  nemuChat: protectedProcedure.input(nemuRequestSchema).handler(async ({ context, input }) => {
    const authenticatedUserId = context.session.user.id;
    const response = await context.nemu.respond(
      { ...input, user_id: authenticatedUserId },
      authenticatedUserId,
    );
    return nemuResponseSchema.parse(response);
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
