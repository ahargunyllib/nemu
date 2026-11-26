import type { RouterClient } from "@orpc/server";

import { documentsRouter } from "../modules/documents/router";
import { extensionRouter } from "../modules/extension/router";
import { gradesRouter } from "../modules/grades/router";
import { healthRouter } from "../modules/health/router";
import { helpRouter } from "../modules/help/router";
import { inboxRouter } from "../modules/inbox/router";
import { processesRouter } from "../modules/processes/router";
import { referenceTablesRouter } from "../modules/reference-tables/router";
import { ruleSourcesRouter } from "../modules/rule-sources/router";
import { schoolRouter } from "../modules/school/router";
import { speechRouter } from "../modules/speech/router";
import { waBotRouter } from "../modules/wa-bot/router";

export const appRouter = {
  ...healthRouter,
  ...documentsRouter,
  ...referenceTablesRouter,
  ...ruleSourcesRouter,
  ...gradesRouter,
  ...inboxRouter,
  ...helpRouter,
  ...processesRouter,
  ...speechRouter,
  ...schoolRouter,
  ...waBotRouter,
  ...extensionRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
