import { z } from "zod";
import { ORPCError } from "@orpc/server";

import type { Context } from "../../context";
import { protectedProcedure } from "../../index";
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

const workspaceSchema = z.literal("W-TELKO").default("W-TELKO");

function requireWorkspace(context: Context, workspaceId: string): void {
  if (context.session?.user.workspaceId !== workspaceId) {
    throw new ORPCError("FORBIDDEN", { message: "Workspace klaim SLA tidak tersedia" });
  }
}

export const slaClaimsRouter = {
  listSlaClaims: protectedProcedure
    .input(z.object({ workspaceId: workspaceSchema }).default({ workspaceId: "W-TELKO" }))
    .handler(({ context, input }) => {
      requireWorkspace(context, input.workspaceId);
      return listSlaClaims(repository(context), input.workspaceId, context.session.user.id);
    }),
  listSlaClaimTasks: protectedProcedure
    .input(z.object({ workspaceId: workspaceSchema }).default({ workspaceId: "W-TELKO" }))
    .handler(({ context, input }) => {
      requireWorkspace(context, input.workspaceId);
      return listSlaClaimTasks(repository(context), input.workspaceId, context.session.user.id);
    }),
  getSlaClaim: protectedProcedure
    .input(
      z.object({
        workspaceId: workspaceSchema,
        claimId: z.string().min(1).max(160),
      }),
    )
    .handler(async ({ context, input }) => {
      requireWorkspace(context, input.workspaceId);
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
  advanceSlaClaimTask: protectedProcedure
    .input(
      z.object({
        workspaceId: workspaceSchema,
        claimId: z.string().min(1).max(160),
      }),
    )
    .handler(async ({ context, input }) => {
      requireWorkspace(context, input.workspaceId);
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
