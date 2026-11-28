import { documentFileLinkSchema } from "@nemu/contracts/school";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { canManagePackages } from "../../authorization";
import type { Context } from "../../context";
import {
  publicProcedure,
  schoolAdminProcedure,
  schoolFullAdminProcedure,
  schoolProcedure,
  workspaceAdminProcedure,
} from "../../index";
import { createCatalogRepository } from "./catalog-repository";
import { createDocumentRepository } from "./repository";
import {
  canEditDocument,
  createDocumentFileLink,
  deleteDocument,
  describeProcess,
  documentFormatOf,
  knowledgeStats,
  listKnowledge,
  readDocumentFile,
  MAX_DOCUMENT_BYTES,
  openSignedDocumentFile,
  setDocumentActive,
  uploadDocument,
} from "./service";

function documentDeps(context: Pick<Context, "db" | "documentFiles" | "school">) {
  return {
    documents: createDocumentRepository(context.db),
    files: context.documentFiles,
    catalog: createCatalogRepository(context.db),
    symptoms: context.school.ai,
  };
}

/** The one package WS-02 manages today: Javan's built-in AlurSekolah guide. */
const ALURSEKOLAH_PACKAGE = "alursekolah";

const uploadDocumentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
  file: z
    .instanceof(File)
    .refine(
      (file) => documentFormatOf(file.name) !== null,
      "Upload a PDF, Markdown (.md) or BPMN (.bpmn) file",
    )
    .refine((file) => file.size <= MAX_DOCUMENT_BYTES, "Upload a file no larger than 10 MB"),
  siteIds: z.array(z.string().min(1)).max(50).default([]),
  packageId: z.literal(ALURSEKOLAH_PACKAGE).nullable().default(null),
});

const documentIdSchema = z.object({ id: z.string().min(1) });

const PACKAGE_READ_ONLY = "Dokumen paket bawaan hanya bisa diubah Admin Javan.";

/** FORBIDDEN for an operator changing a package document: they read it in WS-04, never edit it. */
async function requireEditable(
  context: Pick<Context, "db"> & { session: { user: { workspaceId: string; role: string } } },
  id: string,
) {
  const editable = await canEditDocument(
    { documents: createDocumentRepository(context.db) },
    context.session.user.workspaceId,
    id,
    canManagePackages(context.session.user),
  );
  if (!editable) throw new ORPCError("FORBIDDEN", { message: PACKAGE_READ_ONLY });
}

export const documentsRouter = {
  uploadDocument: workspaceAdminProcedure
    .input(uploadDocumentInputSchema)
    .handler(({ context, input }) => {
      if (input.packageId && !canManagePackages(context.session.user)) {
        throw new ORPCError("FORBIDDEN", { message: PACKAGE_READ_ONLY });
      }
      return uploadDocument(documentDeps(context), {
        ...input,
        workspaceId: context.session.user.workspaceId,
        createdBy: context.session.user.id,
      });
    }),

  /**
   * WS-04: the school's own documents (or WS-02's package), newest first, with who uploaded and
   * switched them. `withPackages` adds the package documents, read-only for an operator.
   */
  listDocuments: workspaceAdminProcedure
    .input(
      z
        .object({
          packageId: z.literal(ALURSEKOLAH_PACKAGE).nullable(),
          withPackages: z.boolean().optional(),
        })
        .optional(),
    )
    .handler(({ context, input }) =>
      listKnowledge(
        { catalog: createCatalogRepository(context.db) },
        context.session.user.workspaceId,
        input?.withPackages ? "all" : { packageId: input?.packageId ?? null },
        canManagePackages(context.session.user),
      ),
    ),

  /** Dokumen dan alur's stat cards: active knowledge, BPMN tasks and recordings. */
  knowledgeStats: workspaceAdminProcedure.handler(({ context }) =>
    knowledgeStats(
      {
        documents: createDocumentRepository(context.db),
        files: context.documentFiles,
        catalog: createCatalogRepository(context.db),
      },
      context.session.user.workspaceId,
    ),
  ),

  /** WS-04: the WS-03 websites a document applies to; empty for every site. */
  setDocumentSites: workspaceAdminProcedure
    .input(documentIdSchema.extend({ siteIds: z.array(z.string().min(1)).max(50) }))
    .handler(async ({ context, input }) => {
      await requireEditable(context, input.id);
      const updated = await createCatalogRepository(context.db).setSites(
        context.session.user.workspaceId,
        input.id,
        input.siteIds,
      );
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Document not found" });
    }),

  /** WS-02 (Admin Javan): the built-in AlurSekolah package and whether every school uses it. */
  getKnowledgePackage: schoolFullAdminProcedure.handler(async ({ context }) => {
    const found = await createCatalogRepository(context.db).findPackage(ALURSEKOLAH_PACKAGE);
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Paket tidak ditemukan" });
    return found;
  }),

  setPackageAllSchools: schoolFullAdminProcedure
    .input(z.object({ allSchools: z.boolean() }))
    .handler(async ({ context, input }) => {
      const updated = await createCatalogRepository(context.db).setPackageAllSchools(
        ALURSEKOLAH_PACKAGE,
        input.allSchools,
        context.session.user.id,
      );
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Paket tidak ditemukan" });
    }),

  /**
   * F3-11 / F3-19: a BPMN's tasks, events and end events with their symptoms, the step that undoes
   * each (`wayBack`), who at school can help (`role`) and pages.
   */
  listProcessElements: schoolAdminProcedure
    .input(documentIdSchema)
    .handler(({ context, input }) =>
      createCatalogRepository(context.db).listProcessElements(
        context.session.user.workspaceId,
        input.id,
      ),
    ),

  /** Dokumen dan alur's BPMN panel: task and gateway counts, and each element's lane and branch. */
  getProcessDetail: schoolAdminProcedure
    .input(documentIdSchema)
    .handler(async ({ context, input }) => {
      const detail = await describeProcess(
        {
          documents: createDocumentRepository(context.db),
          files: context.documentFiles,
          catalog: createCatalogRepository(context.db),
        },
        context.session.user.workspaceId,
        input.id,
      );
      if (!detail) throw new ORPCError("NOT_FOUND", { message: "Alur BPMN tidak ditemukan" });
      return detail;
    }),

  saveProcessElement: schoolAdminProcedure
    .input(
      documentIdSchema.extend({
        elementId: z.string().min(1),
        symptoms: z.array(z.string().trim().min(1).max(200)).max(20),
        page: z.string().trim().max(120).nullable(),
        // Left out: kept as they are.
        wayBack: z.string().trim().max(200).nullable().optional(),
        role: z.string().trim().max(60).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const updated = await createCatalogRepository(context.db).updateProcessElement(
        context.session.user.workspaceId,
        input.id,
        input.elementId,
        {
          symptoms: input.symptoms,
          page: input.page || null,
          pageEdited: true,
          ...(input.wayBack === undefined ? {} : { wayBack: input.wayBack || null }),
          ...(input.role === undefined ? {} : { role: input.role || null }),
        },
      );
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Elemen proses tidak ditemukan" });
    }),

  setDocumentActive: workspaceAdminProcedure
    .input(documentIdSchema.extend({ isActive: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireEditable(context, input.id);
      const document = await setDocumentActive(
        documentDeps(context),
        context.session.user.workspaceId,
        input.id,
        input.isActive,
        context.session.user.id,
      );
      if (!document) throw new ORPCError("NOT_FOUND", { message: "Document not found" });
      return document;
    }),

  deleteDocument: workspaceAdminProcedure
    .input(documentIdSchema)
    .handler(async ({ context, input }) => {
      await requireEditable(context, input.id);
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

  /**
   * Sumber (#258): a short-lived link to a document the teacher's school reads. The extension
   * opens it in a new tab at `#page=<page>`; the tab carries no headers, so the link is signed.
   */
  documentFileLink: schoolProcedure
    .input(documentIdSchema)
    .output(documentFileLinkSchema)
    .handler(async ({ context, input }) => {
      const link = await createDocumentFileLink(
        { documents: createDocumentRepository(context.db), links: context.documentLinks },
        context.caller.workspaceId,
        input.id,
      );
      if (!link) throw new ORPCError("NOT_FOUND", { message: "Dokumen tidak ditemukan" });
      return link;
    }),

  /** The file behind a Sumber link, inline so the browser's PDF viewer opens it at its page. */
  documentFile: publicProcedure
    .route({ method: "GET", path: "/documents/{id}/file" })
    .input(documentIdSchema.extend({ token: z.string().min(1).max(1000) }))
    .handler(async ({ context, input }) => {
      const result = await openSignedDocumentFile(
        {
          documents: createDocumentRepository(context.db),
          files: context.documentFiles,
          links: context.documentLinks,
        },
        input.id,
        input.token,
      );
      switch (result.status) {
        case "ok":
          return new File([result.body], result.document.fileName, {
            type: result.document.contentType,
          });
        case "expired":
          throw new ORPCError("UNAUTHORIZED", {
            message: "Tautan dokumen sudah kedaluwarsa. Buka lagi lewat Sumber di Nemu.",
          });
        case "invalid":
          throw new ORPCError("UNAUTHORIZED", { message: "Tautan dokumen tidak sah." });
        case "not_found":
          throw new ORPCError("NOT_FOUND", { message: "Dokumen tidak ditemukan" });
      }
    }),
};
