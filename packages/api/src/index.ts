import { ORPCError, os } from "@orpc/server";

import type { AuthenticatedContext, Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  // Named so each procedure's declared type refers to it instead of inlining it.
  const authenticated: AuthenticatedContext = { ...context, session: context.session };
  return next({ context: authenticated });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
