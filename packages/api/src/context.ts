import type { Session } from "@nemu/auth";
import type { NemuRequest, NemuResponse } from "@nemu/contracts";
import type { Database } from "@nemu/db";

export type NemuService = {
  respond(request: NemuRequest, authenticatedUserId: string): Promise<NemuResponse>;
};

export type Context = {
  session: Session | null;
  db: Database;
  nemu: NemuService;
};
