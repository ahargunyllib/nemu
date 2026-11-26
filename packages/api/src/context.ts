import type { SchoolAi } from "@nemu/ai/school/runtime";
import type { Session } from "@nemu/auth";
import type { Database } from "@nemu/db";

import type { InternalCaller } from "./internal-caller";
import type { SchoolDirectory } from "./modules/school/directory";
import type { WorkspaceId } from "./workspace-ids";

// Where uploaded knowledge document files live (R2 in the Worker, a fake in tests).
export type DocumentFileStore = {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
};

// Short-lived photo jobs (R2 in the Worker with a 1-day lifecycle rule, a fake in tests).
export type InboxFileStore = DocumentFileStore & {
  list(prefix: string): Promise<string[]>;
};

/** Nemu v2.2 school services: the model seam (ADR-0001), the teacher directory, and the photo inbox. */
export type SchoolServices = {
  ai: SchoolAi;
  directory: SchoolDirectory;
  inbox: InboxFileStore;
};

/** What the Nemu Extension sends instead of a session (ADR-0014); null for every other caller. */
export type ExtensionCredentials = { installCode: string | null; email: string | null };

export type Context = {
  session: Session | null;
  db: Database;
  documentFiles: DocumentFileStore;
  school: SchoolServices;
  /** Workspace-owned demo date (YYYY-MM-DD) the school AI treats as today. */
  demoDate: string;
  /** Set when an internal service (the WhatsApp bot) sent its shared secret; see `internal-caller.ts`. */
  internalCaller?: InternalCaller | null;
  /** Set when the request carries the extension's install code or page email headers. */
  extension?: ExtensionCredentials | null;
};

export type AuthenticatedSession = Session & {
  user: Session["user"] & { role: string; workspaceId: WorkspaceId };
};

/** The context of a `protectedProcedure`: the session and authorization fields are always there. */
export type AuthenticatedContext = Omit<Context, "session"> & { session: AuthenticatedSession };
