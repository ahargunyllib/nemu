import { ORPCError, os } from "@orpc/server";

import type { AuthenticatedContext, Context } from "./context";
import { requireWorkspace, requireWorkspaceAdmin } from "./authorization";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user?.role || !context.session.user.workspaceId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  // Named so each procedure's declared type refers to it instead of inlining it.
  const authenticated = { ...context, session: context.session } as AuthenticatedContext;
  return next({ context: authenticated });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireAdmin = o.middleware(async ({ context, next }) => {
  if (!context.session?.user?.role || !context.session.user.workspaceId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  try {
    requireWorkspaceAdmin({
      id: context.session.user.id,
      role: context.session.user.role,
      workspaceId: context.session.user.workspaceId,
    });
  } catch (error) {
    throw new ORPCError("FORBIDDEN", {
      message:
        error instanceof Error ? error.message : "Workspace administrator access is required",
    });
  }
  const authenticated = { ...context, session: context.session } as AuthenticatedContext;
  return next({ context: authenticated });
});

export const workspaceAdminProcedure = publicProcedure.use(requireAdmin);

const requireTravelWorkspace = o.middleware(async ({ context, next }) => {
  if (!context.session?.user?.workspaceId) throw new ORPCError("UNAUTHORIZED");
  try {
    requireWorkspace(context.session.user.workspaceId, "W-TRAVEL");
  } catch (error) {
    throw new ORPCError("FORBIDDEN", {
      message: error instanceof Error ? error.message : "Travel workspace access is required",
    });
  }
  return next();
});

// The current reference-table schema contains travel-only SBM, city, and holiday data.
export const travelAdminProcedure = workspaceAdminProcedure.use(requireTravelWorkspace);
