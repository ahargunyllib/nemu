import {
  alurSekolahConnectionSchema,
  integrationSecretStatusSchema,
  saveIntegrationSecretInputSchema,
} from "@nemu/contracts/integrations";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { AuthenticatedContext } from "../../context";
import { fullAdminProcedure, workspaceAdminProcedure } from "../../index";
import { checkConnection } from "../alursekolah/service";
import { MissingSecretKeyError } from "./cipher";
import { createIntegrationSecretRepository } from "./repository";
import { listSecrets, saveSecret } from "./service";

function integrationDeps(context: Pick<AuthenticatedContext, "db" | "secretCipher">) {
  return { secrets: createIntegrationSecretRepository(context.db), cipher: context.secretCipher };
}

/**
 * WS-07. Values go in; only "set or not" and the last 4 characters come out. Admin Javan fills it;
 * the school operator sees that masked list and nothing else (ADR-0022).
 */
export const integrationsRouter = {
  listIntegrationSecrets: workspaceAdminProcedure
    .output(z.array(integrationSecretStatusSchema))
    .handler(({ context }) =>
      listSecrets(integrationDeps(context), context.session.user.workspaceId),
    ),

  saveIntegrationSecret: fullAdminProcedure
    .input(saveIntegrationSecretInputSchema)
    .output(z.object({ lastFour: z.string() }))
    .handler(async ({ context, input }) => {
      const result = await saveSecret(integrationDeps(context), {
        workspaceId: context.session.user.workspaceId,
        updatedBy: context.session.user.id,
        name: input.name,
        value: input.value,
      }).catch((error: unknown) => {
        if (error instanceof MissingSecretKeyError) {
          throw new ORPCError("PRECONDITION_FAILED", {
            message: "Kunci enkripsi INTEGRATION_SECRETS_KEY belum dipasang di Nemu Service.",
            cause: error,
          });
        }
        throw error;
      });
      if (result.status === "invalid")
        throw new ORPCError("BAD_REQUEST", { message: result.message });
      return { lastFour: result.lastFour };
    }),

  checkAlurSekolahConnection: fullAdminProcedure
    .output(alurSekolahConnectionSchema)
    .handler(({ context }) =>
      checkConnection(context.school.alurSekolah, context.session.user.workspaceId),
    ),
};
