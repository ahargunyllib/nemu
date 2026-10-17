import type { Session } from "@nemu/auth";
import type { NemuRequest, NemuResponse } from "@nemu/contracts";
import type { Database } from "@nemu/db";

export type NemuService = {
  respond(request: NemuRequest, authenticatedUserId: string): Promise<NemuResponse>;
};

// Where uploaded knowledge document files live (R2 in the Worker, a fake in tests).
export type DocumentFileStore = {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
};

export type Context = {
  session: Session | null;
  db: Database;
  nemu: NemuService;
  documentFiles: DocumentFileStore;
  /** "Today" in the demo (NEMU_DEMO_DATE, YYYY-MM-DD), shared by the Demo App and the AI. */
  demoDate: string;
};

/** The context of a `protectedProcedure`: the session is always there. */
export type AuthenticatedContext = Context & { session: Session };
