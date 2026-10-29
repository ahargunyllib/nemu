import {
  ajukanPerjalananDinasInputSchema,
  processInstanceIdInputSchema,
  unggahDokumenInputSchema,
} from "@nemu/contracts/process-instance";
import { ORPCError } from "@orpc/server";

import { protectedProcedure, travelProcedure } from "../../index";
import {
  type ProcessResult,
  ajukanPerjalananDinas,
  createProcessInstanceDeps,
  getProcessInstance,
  kirimPertanggungjawaban,
  listMyProcessInstances,
  listMyTasks,
  majukanState,
  resetDemo,
  unggahDokumenPertanggungjawaban,
} from "./service";

function unwrap<T>(result: ProcessResult<T>): T {
  if (!result.ok) throw new ORPCError(result.code, { message: result.message });
  return result.value;
}

export const processInstancesRouter = {
  ajukanPerjalananDinas: travelProcedure
    .input(ajukanPerjalananDinasInputSchema)
    .handler(({ context, input }) =>
      ajukanPerjalananDinas(createProcessInstanceDeps(context.db), context.session.user.id, input),
    ),

  listMyProcessInstances: travelProcedure.handler(({ context }) =>
    listMyProcessInstances(createProcessInstanceDeps(context.db), context.session.user.id),
  ),

  listMyTasks: travelProcedure.handler(({ context }) =>
    listMyTasks(createProcessInstanceDeps(context.db), context.session.user.id, context.demoDate),
  ),

  getProcessInstance: travelProcedure
    .input(processInstanceIdInputSchema)
    .handler(async ({ context, input }) => {
      const instance = await getProcessInstance(
        createProcessInstanceDeps(context.db),
        context.session.user.id,
        input.instanceId,
        context.demoDate,
      );
      if (!instance) {
        throw new ORPCError("NOT_FOUND", {
          message: `Pengajuan ${input.instanceId} tidak ditemukan`,
        });
      }
      return instance;
    }),

  unggahDokumenPertanggungjawaban: travelProcedure
    .input(unggahDokumenInputSchema)
    .handler(async ({ context, input }) =>
      unwrap(
        await unggahDokumenPertanggungjawaban(
          createProcessInstanceDeps(context.db),
          context.session.user.id,
          input,
        ),
      ),
    ),

  kirimPertanggungjawaban: travelProcedure
    .input(processInstanceIdInputSchema)
    .handler(async ({ context, input }) =>
      unwrap(
        await kirimPertanggungjawaban(
          createProcessInstanceDeps(context.db),
          context.session.user.id,
          input.instanceId,
        ),
      ),
    ),

  majukanState: travelProcedure
    .input(processInstanceIdInputSchema)
    .handler(async ({ context, input }) =>
      unwrap(
        await majukanState(
          createProcessInstanceDeps(context.db),
          context.session.user.id,
          input.instanceId,
        ),
      ),
    ),

  // Reset demo and the demo clock serve every workspace's Demo App, not only Perjalanan Dinas.
  resetDemo: protectedProcedure.handler(({ context }) =>
    resetDemo(createProcessInstanceDeps(context.db), context.session.user.id),
  ),

  getDemoClock: protectedProcedure.handler(({ context }) => ({ today: context.demoDate })),
};
