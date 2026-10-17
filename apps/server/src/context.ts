import type { Context as ApiContext } from "@nemu/api/context";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import { createAuth, createDocumentFileStore, createNemuService, getDb } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const db = await getDb();
  const session = await (
    await createAuth(db)
  ).api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
    nemu: createNemuService(),
    documentFiles: createDocumentFileStore(),
    demoDate: ENV.NEMU_DEMO_DATE,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
