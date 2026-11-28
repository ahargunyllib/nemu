import type { client } from "@/shared/api/orpc";

/** A row of Dokumen dan alur: a document with who uploaded it and whether this user may change it. */
export type KnowledgeDocument = Awaited<ReturnType<typeof client.listDocuments>>[number];
