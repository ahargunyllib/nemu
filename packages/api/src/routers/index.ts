import type { RouterClient } from "@orpc/server";

import { chatRouter } from "../modules/chat/router";
import { documentsRouter } from "../modules/documents/router";
import { gradesRouter } from "../modules/grades/router";
import { healthRouter } from "../modules/health/router";
import { helpRouter } from "../modules/help/router";
import { inboxRouter } from "../modules/inbox/router";
import { processInstancesRouter } from "../modules/process-instances/router";
import { processesRouter } from "../modules/processes/router";
import { referenceTablesRouter } from "../modules/reference-tables/router";
import { ruleSourcesRouter } from "../modules/rule-sources/router";
import { schoolRouter } from "../modules/school/router";
import { slaClaimsRouter } from "../modules/sla-claims/router";
import { speechRouter } from "../modules/speech/router";

export const appRouter = {
  ...healthRouter,
  ...chatRouter,
  ...documentsRouter,
  ...referenceTablesRouter,
  ...ruleSourcesRouter,
  ...processInstancesRouter,
  ...slaClaimsRouter,
  ...gradesRouter,
  ...inboxRouter,
  ...helpRouter,
  ...processesRouter,
  ...speechRouter,
  ...schoolRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
