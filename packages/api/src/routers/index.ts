import type { RouterClient } from "@orpc/server";

import { chatRouter } from "../modules/chat/router";
import { documentsRouter } from "../modules/documents/router";
import { healthRouter } from "../modules/health/router";
import { processInstancesRouter } from "../modules/process-instances/router";
import { referenceTablesRouter } from "../modules/reference-tables/router";

export const appRouter = {
  ...healthRouter,
  ...chatRouter,
  ...documentsRouter,
  ...referenceTablesRouter,
  ...processInstancesRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
