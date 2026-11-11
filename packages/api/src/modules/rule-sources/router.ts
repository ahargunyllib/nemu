import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { workspaceAdminProcedure } from "../../index";
import { createDocumentRepository } from "../documents/repository";
import { createRuleSourceRepository } from "./repository";
import { listRuleSources, resetRuleSource, setRuleSource } from "./service";

function ruleSourceDeps(context: Pick<Context, "db">) {
  return {
    ruleSources: createRuleSourceRepository(context.db),
    documents: createDocumentRepository(context.db),
  };
}

const ruleKeySchema = z.object({ key: z.string().min(1) });

export const ruleSourcesRouter = {
  listRuleSources: workspaceAdminProcedure.handler(({ context }) =>
    listRuleSources(ruleSourceDeps(context), context.session.user.workspaceId),
  ),

  setRuleSource: workspaceAdminProcedure
    .input(
      ruleKeySchema.extend({
        documentId: z.string().min(1),
        article: z.string().trim().max(200).optional(),
        page: z.number().int().positive().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await setRuleSource(
        ruleSourceDeps(context),
        context.session.user.workspaceId,
        input,
      );
      if (result === "rule_not_found") {
        throw new ORPCError("NOT_FOUND", { message: "Rule not found in this workspace" });
      }
      if (result === "document_not_found") {
        throw new ORPCError("NOT_FOUND", { message: "Document not found in this workspace" });
      }
    }),

  resetRuleSource: workspaceAdminProcedure
    .input(ruleKeySchema)
    .handler(({ context, input }) =>
      resetRuleSource(ruleSourceDeps(context), context.session.user.workspaceId, input.key),
    ),
};
