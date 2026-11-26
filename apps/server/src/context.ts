import type { Context as ApiContext } from "@nemu/api/context";
import { internalCallerFor } from "@nemu/api/internal-caller";
import { EXTENSION_HEADERS } from "@nemu/contracts/extension";
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

/** The Nemu Extension's install code and page email (ADR-0014), when the request carries either. */
function extensionCredentials(headers: Headers): ApiContext["extension"] {
  const installCode = headers.get(EXTENSION_HEADERS.installCode);
  const email = headers.get(EXTENSION_HEADERS.email);
  return installCode || email ? { installCode, email } : null;
}

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
    extension: extensionCredentials(context.req.raw.headers),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
