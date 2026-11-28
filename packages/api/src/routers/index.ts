import type { RouterClient } from "@orpc/server";

import { actionLogRouter } from "../modules/action-log/router";
import { documentsRouter } from "../modules/documents/router";
import { extensionRouter } from "../modules/extension/router";
import { gradesRouter } from "../modules/grades/router";
import { healthRouter } from "../modules/health/router";
import { helpRouter } from "../modules/help/router";
import { inboxRouter } from "../modules/inbox/router";
import { integrationsRouter } from "../modules/integrations/router";
import { kamusRouter } from "../modules/kamus/router";
import { processesRouter } from "../modules/processes/router";
import { quizRouter } from "../modules/quiz/router";
import { referenceTablesRouter } from "../modules/reference-tables/router";
import { ruleSourcesRouter } from "../modules/rule-sources/router";
import { schoolRouter } from "../modules/school/router";
import { speechRouter } from "../modules/speech/router";
import { teacherQuestionsRouter } from "../modules/teacher-questions/router";
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
  ...integrationsRouter,
  ...actionLogRouter,
  ...kamusRouter,
  ...quizRouter,
  ...teacherQuestionsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
