import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { workspaceAdminProcedure } from "../../index";
import { createDocumentRepository } from "./repository";
import {
  deleteDocument,
  documentFormatOf,
  listDocuments,
  readDocumentFile,
  MAX_DOCUMENT_BYTES,
  setDocumentActive,
  uploadDocument,
} from "./service";

function documentDeps(context: Pick<Context, "db" | "documentFiles">) {
  return {
    documents: createDocumentRepository(context.db),
    files: context.documentFiles,
  };
}

const uploadDocumentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
  file: z
    .instanceof(File)
    .refine((file) => documentFormatOf(file.name) !== null, "Upload a PDF or Markdown (.md) file")
    .refine((file) => file.size <= MAX_DOCUMENT_BYTES, "Upload a file no larger than 10 MB"),
});

const documentIdSchema = z.object({ id: z.string().min(1) });

export const documentsRouter = {
  uploadDocument: workspaceAdminProcedure
    .input(uploadDocumentInputSchema)
    .handler(({ context, input }) =>
      uploadDocument(documentDeps(context), {
        ...input,
        workspaceId: context.session.user.workspaceId,
      }),
    ),

  listDocuments: workspaceAdminProcedure.handler(({ context }) =>
    listDocuments(documentDeps(context), context.session.user.workspaceId),
  ),

  setDocumentActive: workspaceAdminProcedure
    .input(documentIdSchema.extend({ isActive: z.boolean() }))
    .handler(async ({ context, input }) => {
      const document = await setDocumentActive(
        documentDeps(context),
        context.session.user.workspaceId,
        input.id,
        input.isActive,
      );
      if (!document) throw new ORPCError("NOT_FOUND", { message: "Document not found" });
      return document;
    }),

  deleteDocument: workspaceAdminProcedure
    .input(documentIdSchema)
    .handler(async ({ context, input }) => {
      const document = await deleteDocument(
        documentDeps(context),
        context.session.user.workspaceId,
        input.id,
      );
      if (!document) throw new ORPCError("NOT_FOUND", { message: "Document not found" });
      return document;
    }),

  getDocumentFile: workspaceAdminProcedure
    .input(documentIdSchema)
    .handler(async ({ context, input }) => {
      const result = await readDocumentFile(
        documentDeps(context),
        context.session.user.workspaceId,
        input.id,
      );
      if (!result) throw new ORPCError("NOT_FOUND", { message: "Document file not found" });
      return new File([result.body], result.document.fileName, {
        type: result.document.contentType,
      });
    }),
};
