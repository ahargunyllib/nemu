import { z } from "zod";
import { ORPCError } from "@orpc/server";

import type { Context } from "../../context";
import { telcoProcedure } from "../../index";
import { WORKSPACES } from "../../workspace-ids";
import { createSlaClaimRepository } from "./repository";
import {
  advanceSlaClaimTask,
  getSlaClaimDetail,
  listSlaClaims,
  listSlaClaimTasks,
  SlaClaimAccessError,
  SlaClaimNotFoundError,
} from "./service";

function repository(context: Pick<Context, "db">) {
  return createSlaClaimRepository(context.db);
}

// The Demo App names the workspace; `telcoProcedure` checks the session belongs to it.
const workspaceSchema = z.literal(WORKSPACES.telco).default(WORKSPACES.telco);
const workspaceInputSchema = z
  .object({ workspaceId: workspaceSchema })
  .default({ workspaceId: WORKSPACES.telco });

export const slaClaimsRouter = {
  listSlaClaims: telcoProcedure
    .input(workspaceInputSchema)
    .handler(({ context, input }) =>
      listSlaClaims(repository(context), input.workspaceId, context.session.user.id),
    ),
  listSlaClaimTasks: telcoProcedure
    .input(workspaceInputSchema)
    .handler(({ context, input }) =>
      listSlaClaimTasks(repository(context), input.workspaceId, context.session.user.id),
    ),
  getSlaClaim: telcoProcedure
    .input(
      z.object({
        workspaceId: workspaceSchema,
        claimId: z.string().min(1).max(160),
      }),
    )
    .handler(async ({ context, input }) => {
      try {
        return await getSlaClaimDetail(
          repository(context),
          input.workspaceId,
          input.claimId,
          context.session.user.id,
        );
      } catch (error) {
        if (error instanceof SlaClaimNotFoundError) {
          throw new ORPCError("NOT_FOUND", { message: error.message });
        }
        if (error instanceof SlaClaimAccessError) {
          throw new ORPCError("FORBIDDEN", { message: error.message });
        }
        throw error;
      }
    }),
  advanceSlaClaimTask: telcoProcedure
    .input(
      z.object({
        workspaceId: workspaceSchema,
        claimId: z.string().min(1).max(160),
      }),
    )
    .handler(async ({ context, input }) => {
      try {
        return await advanceSlaClaimTask(repository(context), input.workspaceId, input.claimId, {
          id: context.session.user.id,
        });
      } catch (error) {
        if (error instanceof SlaClaimNotFoundError) {
          throw new ORPCError("NOT_FOUND", { message: error.message });
        }
        if (error instanceof SlaClaimAccessError) {
          throw new ORPCError("FORBIDDEN", { message: error.message });
        }
        throw error;
      }
    }),
};
