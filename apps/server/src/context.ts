import type { Context as ApiContext } from "@nemu/api/context";
import { internalCallerFor } from "@nemu/api/internal-caller";
import { WORKSPACES } from "@nemu/api/workspace-ids";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import {
  createAuth,
  createDocumentFileStore,
  createNemuService,
  createSchoolServices,
  getDb,
  getWorkspaceDemoDate,
} from "./services";

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
  const workspaceId = session?.user.workspaceId ?? WORKSPACES.travel;
  return {
    db,
    session,
    nemu: createNemuService(db),
    documentFiles: createDocumentFileStore(),
    school: createSchoolServices(db),
    demoDate: await getWorkspaceDemoDate(db, workspaceId),
    internalCaller: await internalCallerFor(context.req.raw.headers, {
      waBot: ENV.WA_BOT_SECRET,
    }),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
