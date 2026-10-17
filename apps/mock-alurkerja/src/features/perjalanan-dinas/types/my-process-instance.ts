import type { AppRouter } from "@nemu/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

/** A Process Instance as My Request receives it from the Nemu Service. */
export type MyProcessInstance = InferRouterOutputs<AppRouter>["listMyProcessInstances"][number];
