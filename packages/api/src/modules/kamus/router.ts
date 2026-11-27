import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { schoolAdminProcedure } from "../../index";
import { createKamusRepository } from "./repository";
import { importKamusExcel } from "./service";

const MAX_EXCEL_BYTES = 2 * 1024 * 1024;

const kamusEntrySchema = z.object({
  code: z.string().trim().min(1).max(20),
  app: z.string().trim().min(1).max(60),
  message: z.string().trim().min(1).max(500),
  meaning: z.string().trim().max(500),
  teacherFault: z.boolean(),
  fixer: z.enum(["guru", "operator", "kepsek", "keuangan", "dinas"]),
  fix: z.string().trim().min(1).max(500),
});

const notFound = () => new ORPCError("NOT_FOUND", { message: "Entri kamus tidak ditemukan" });

/** WS-05 Kamus Kendala (operator or Admin Javan): the rows "ini kenapa?" answers from. */
export const kamusRouter = {
  listKamus: schoolAdminProcedure.handler(({ context }) =>
    createKamusRepository(context.db).list(context.session.user.workspaceId),
  ),

  createKamus: schoolAdminProcedure
    .input(kamusEntrySchema)
    .handler(({ context, input }) =>
      createKamusRepository(context.db).insert(context.session.user.workspaceId, input),
    ),

  updateKamus: schoolAdminProcedure
    .input(kamusEntrySchema.extend({ id: z.string().min(1) }))
    .handler(async ({ context, input: { id, ...entry } }) => {
      const updated = await createKamusRepository(context.db).update(
        context.session.user.workspaceId,
        id,
        entry,
      );
      if (!updated) throw notFound();
    }),

  deleteKamus: schoolAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const deleted = await createKamusRepository(context.db).delete(
        context.session.user.workspaceId,
        input.id,
      );
      if (!deleted) throw notFound();
    }),

  importKamus: schoolAdminProcedure
    .input(
      z.object({
        file: z
          .instanceof(File)
          .refine((file) => /\.(xlsx|xls)$/iu.test(file.name), "Unggah file Excel (.xlsx)")
          .refine((file) => file.size <= MAX_EXCEL_BYTES, "File Excel paling besar 2 MB"),
      }),
    )
    .handler(async ({ context, input }) =>
      importKamusExcel(
        createKamusRepository(context.db),
        context.session.user.workspaceId,
        new Uint8Array(await input.file.arrayBuffer()),
      ),
    ),
};
