import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { protectedProcedure } from "../../index";
import { createReferenceTableRepository } from "./repository";
import { listReferenceTables, readReferenceTable, uploadReferenceTable } from "./service";
import { REFERENCE_TABLE_TYPES } from "./table-types";

function referenceTableDeps(context: Pick<Context, "db">) {
  return { tables: createReferenceTableRepository(context.db) };
}

export const referenceTablesRouter = {
  uploadReferenceTable: protectedProcedure
    .input(
      z.object({
        file: z
          .instanceof(File)
          .refine((file) => /\.csv$/i.test(file.name), "Upload a CSV (.csv) file"),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await uploadReferenceTable(referenceTableDeps(context), input.file);
      if (!result.ok) throw new ORPCError("BAD_REQUEST", { message: result.reason });
      return result.table;
    }),

  listReferenceTables: protectedProcedure.handler(({ context }) =>
    listReferenceTables(referenceTableDeps(context)),
  ),

  getReferenceTable: protectedProcedure
    .input(z.object({ type: z.enum(REFERENCE_TABLE_TYPES) }))
    .handler(async ({ context, input }) => {
      const table = await readReferenceTable(referenceTableDeps(context), input.type);
      if (!table) throw new ORPCError("NOT_FOUND", { message: "Table has not been uploaded" });
      return table;
    }),
};
