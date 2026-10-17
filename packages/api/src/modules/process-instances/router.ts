import { ajukanPerjalananDinasInputSchema } from "@nemu/contracts/process-instance";

import type { Context } from "../../context";
import { protectedProcedure } from "../../index";
import { createProcessInstanceRepository } from "./repository";
import { ajukanPerjalananDinas, listMyProcessInstances } from "./service";

function processInstanceDeps(context: Pick<Context, "db">) {
  return { processInstances: createProcessInstanceRepository(context.db) };
}

export const processInstancesRouter = {
  ajukanPerjalananDinas: protectedProcedure
    .input(ajukanPerjalananDinasInputSchema)
    .handler(({ context, input }) =>
      ajukanPerjalananDinas(processInstanceDeps(context), context.session.user.id, input),
    ),

  listMyProcessInstances: protectedProcedure.handler(({ context }) =>
    listMyProcessInstances(processInstanceDeps(context), context.session.user.id),
  ),
};
