import type { TeacherProfile } from "@nemu/ai/school/profile";
import { EXTENSION_REFUSALS } from "@nemu/contracts/extension";
import { ORPCError, os } from "@orpc/server";

import type { AuthenticatedContext, Context } from "./context";
import {
  requireFullAdmin,
  requireKnownWorkspace,
  requireWorkspace,
  requireWorkspaceAdmin,
} from "./authorization";
import { createExtensionRepository, type InstalledSchool } from "./modules/extension/repository";
import { identifyTeacher, installedSchool } from "./modules/extension/service";
import { createSchoolRepository } from "./modules/school/repository";
import { requireTeacher } from "./modules/school/teacher";
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

/** Admin Workspace pages for a workspace's administrators, school operators included. */
export const workspaceAdminProcedure = publicProcedure.use(requireAdmin);

const requireFullAdminRole = o.middleware(async ({ context, next }) => {
  const authenticated = authenticate(context);
  forbidUnless(() => requireFullAdmin(authenticated.session.user));
  return next({ context: authenticated });
});

/** Pages only Admin Javan sees (WS-01 school list); a school operator gets FORBIDDEN. */
export const fullAdminProcedure = publicProcedure.use(requireFullAdminRole);

function requireWorkspaceAccess(workspaceId: WorkspaceId) {
  return o.middleware(async ({ context, next }) => {
    const { session } = authenticate(context);
    forbidUnless(() => requireWorkspace(session.user.workspaceId, workspaceId));
    return next();
  });
}

async function requireInstalledSchool(context: Context): Promise<InstalledSchool> {
  const school = await installedSchool(
    createExtensionRepository(context.db),
    context.extension?.installCode,
  );
  if (!school) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Kode pemasangan sekolah tidak dikenal. Periksa lagi di pengaturan Nemu.",
      data: { reason: EXTENSION_REFUSALS.invalidInstallCode },
    });
  }
  return school;
}

/** Nemu Extension requests that need only the school's install code (ADR-0015). */
export const extensionProcedure = publicProcedure.use(async ({ context, next }) =>
  next({ context: { installedSchool: await requireInstalledSchool(context) } }),
);

/** Who is calling a school procedure, whichever way they proved it. */
export type SchoolCaller = {
  workspaceId: string;
  /** The caller's WS-06 teacher profile, or FORBIDDEN for an account without one. */
  requireTeacher(): Promise<TeacherProfile>;
};

async function extensionCaller(context: Context): Promise<SchoolCaller> {
  const school = await requireInstalledSchool(context);
  const email = context.extension?.email?.trim();
  if (!email) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Masuk ke AlurSekolah dulu, supaya Nemu tahu siapa yang memakai.",
      data: { reason: EXTENSION_REFUSALS.missingEmail },
    });
  }
  const identity = await identifyTeacher(
    { directory: context.school.directory, school: createSchoolRepository(context.db) },
    school,
    email,
  );
  if ("unregistered" in identity) {
    throw new ORPCError("FORBIDDEN", {
      message: identity.unregistered.message,
      data: { reason: EXTENSION_REFUSALS.unregistered },
    });
  }
  return { workspaceId: school.workspaceId, requireTeacher: async () => identity.teacher };
}

/**
 * Nemu school procedures (AlurSekolah). A W-SEKOLAH session reaches them, and so does the Nemu
 * Extension with a valid install code and the email of a registered teacher (ADR-0015).
 */
export const schoolProcedure = publicProcedure.use(async ({ context, next }) => {
  if (context.extension) return next({ context: { caller: await extensionCaller(context) } });
  const { session } = authenticate(context);
  forbidUnless(() => requireWorkspace(session.user.workspaceId, WORKSPACES.school));
  const caller: SchoolCaller = {
    workspaceId: session.user.workspaceId,
    requireTeacher: () => requireTeacher(context.school.directory, session.user.id),
  };
  return next({ context: { caller } });
});

/** School procedures for the operator or Admin Javan: saving a recorded procedure, WS-06. */
export const schoolAdminProcedure = workspaceAdminProcedure.use(
  requireWorkspaceAccess(WORKSPACES.school),
);

/** School pages only Admin Javan sees: WS-02 package, WS-03 websites, WS-08 settings, WS-10 log. */
export const schoolFullAdminProcedure = fullAdminProcedure.use(
  requireWorkspaceAccess(WORKSPACES.school),
);

/** Procedures only the WhatsApp bot calls, with its shared secret instead of a user session. */
export const waBotProcedure = publicProcedure.use(async ({ context, next }) => {
  if (context.internalCaller !== "wa-bot") {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Send the wa-bot shared secret (WA_BOT_SECRET) as a Bearer token",
    });
  }
  return next();
});

// The current reference-table schema contains travel-only SBM, city, and holiday data.
export const travelAdminProcedure = workspaceAdminProcedure.use(
  requireWorkspaceAccess(WORKSPACES.travel),
);
