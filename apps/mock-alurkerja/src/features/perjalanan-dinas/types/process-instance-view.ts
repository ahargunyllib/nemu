import type { AppRouter } from "@nemu/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

/** A Process Instance with its active Task and uploaded documents, as the task pages receive it. */
export type ProcessInstanceView = InferRouterOutputs<AppRouter>["getProcessInstance"];
