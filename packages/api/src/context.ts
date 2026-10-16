import type { Session } from "@nemu/auth";
import type { Database } from "@nemu/db";

export type Context = {
  session: Session | null;
  db: Database;
};
