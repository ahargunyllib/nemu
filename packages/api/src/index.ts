import { ORPCError, os } from "@orpc/server";

import type { AuthenticatedContext, Context } from "./context";
import { requireKnownWorkspace, requireWorkspace, requireWorkspaceAdmin } from "./authorization";
import { WORKSPACES, type WorkspaceId } from "./workspace-ids";

export const o = os.$context<Context>();

export const publicProcedure = o;

function forbidUnless<T>(check: () => T): T {
  try {
    return check();
  } catch (error) {
    throw new ORPCError("FORBIDDEN", {
      message: error instanceof Error ? error.message : "Access is required",
    });
  }
}

// Rejects a missing session, and a session whose workspace Nemu doesn't serve.
function authenticate(context: Context): AuthenticatedContext {
  const session = context.session;
  if (!session?.user?.role || !session.user.workspaceId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const { role, workspaceId } = session.user;
  const user = {
    ...session.user,
    role,
    workspaceId: forbidUnless(() => requireKnownWorkspace(workspaceId)),
  };
  return { ...context, session: { ...session, user } };
}

const requireAuth = o.middleware(async ({ context, next }) =>
  next({ context: authenticate(context) }),
);

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireAdmin = o.middleware(async ({ context, next }) => {
  const authenticated = authenticate(context);
  forbidUnless(() => requireWorkspaceAdmin(authenticated.session.user));
  return next({ context: authenticated });
});

export const workspaceAdminProcedure = publicProcedure.use(requireAdmin);

function requireWorkspaceAccess(workspaceId: WorkspaceId) {
  return o.middleware(async ({ context, next }) => {
    const { session } = authenticate(context);
    forbidUnless(() => requireWorkspace(session.user.workspaceId, workspaceId));
    return next();
  });
}

/** Perjalanan Dinas procedures: only W-TRAVEL users reach them. */
export const travelProcedure = protectedProcedure.use(requireWorkspaceAccess(WORKSPACES.travel));

/** Klaim SLA procedures: only W-TELKO users reach them. */
export const telcoProcedure = protectedProcedure.use(requireWorkspaceAccess(WORKSPACES.telco));

// The current reference-table schema contains travel-only SBM, city, and holiday data.
export const travelAdminProcedure = workspaceAdminProcedure.use(
  requireWorkspaceAccess(WORKSPACES.travel),
);
