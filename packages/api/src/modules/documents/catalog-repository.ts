import { and, asc, type Database, desc, eq, getColumns, inArray, isNull } from "@nemu/db";
import { user } from "@nemu/db/schema/auth";
import {
  knowledgeChunk,
  knowledgeDocument,
  knowledgePackage,
  processElement,
} from "@nemu/db/schema/documents";

import type { ActiveKnowledgeChunkRecord, DocumentRecord } from "./repository";

export type CatalogDocument = DocumentRecord & {
  createdByName: string | null;
  changedByName: string | null;
};
export type ProcessElementRecord = typeof processElement.$inferSelect;
export type PackageRecord = { id: string; title: string; allSchools: boolean; updatedAt: Date };

/**
 * What the Admin Workspace shows and edits about knowledge beyond the file itself: who uploaded
 * and switched it (WS-04), the websites it applies to, the package (WS-02), and BPMN elements.
 */
export type CatalogRepository = {
  /** The school's own documents (`packageId` null) or one package's documents. */
  listDocuments(workspaceId: string, packageId: string | null): Promise<CatalogDocument[]>;
  setSites(workspaceId: string, id: string, siteIds: string[]): Promise<boolean>;
  /** Chunks of ready documents, active or not, for Uji jawaban (WS-09). */
  listReadyChunks(
    workspaceId: string,
    documentIds: string[],
  ): Promise<ActiveKnowledgeChunkRecord[]>;
  findPackage(id: string): Promise<PackageRecord | undefined>;
  setPackageAllSchools(id: string, allSchools: boolean, userId: string): Promise<boolean>;
  replaceProcessElements(documentId: string, elements: ProcessElementRecord[]): Promise<void>;
  listProcessElements(workspaceId: string, documentId: string): Promise<ProcessElementRecord[]>;
  updateProcessElement(
    workspaceId: string,
    documentId: string,
    elementId: string,
    changes: Pick<ProcessElementRecord, "symptoms" | "page" | "pageEdited">,
  ): Promise<boolean>;
};

// D1 binds at most 100 parameters per statement, one per column of each row.
const ELEMENT_ROWS_PER_INSERT = Math.floor(100 / Object.keys(getColumns(processElement)).length);

async function ownsDocument(db: Database, workspaceId: string, documentId: string) {
  const [found] = await db
    .select({ id: knowledgeDocument.id })
    .from(knowledgeDocument)
    .where(
      and(eq(knowledgeDocument.workspaceId, workspaceId), eq(knowledgeDocument.id, documentId)),
    )
    .limit(1);
  return !!found;
}

export function createCatalogRepository(db: Database): CatalogRepository {
  return {
    async listDocuments(workspaceId, packageId) {
      const documents = await db
        .select()
        .from(knowledgeDocument)
        .where(
          and(
            eq(knowledgeDocument.workspaceId, workspaceId),
            packageId === null
              ? isNull(knowledgeDocument.packageId)
              : eq(knowledgeDocument.packageId, packageId),
          ),
        )
        .orderBy(desc(knowledgeDocument.createdAt));
      const userIds = [
        ...new Set(documents.flatMap((document) => [document.createdBy, document.changedBy])),
      ].filter((id): id is string => !!id);
      const names = new Map(
        userIds.length
          ? (
              await db
                .select({ id: user.id, name: user.name })
                .from(user)
                .where(inArray(user.id, userIds))
            ).map((row) => [row.id, row.name])
          : [],
      );
      const nameOf = (id: string | null) => (id ? (names.get(id) ?? null) : null);
      return documents.map((document) => ({
        ...document,
        createdByName: nameOf(document.createdBy),
        changedByName: nameOf(document.changedBy),
      }));
    },
    async setSites(workspaceId, id, siteIds) {
      const updated = await db
        .update(knowledgeDocument)
        .set({ siteIds })
        .where(and(eq(knowledgeDocument.workspaceId, workspaceId), eq(knowledgeDocument.id, id)))
        .returning({ id: knowledgeDocument.id });
      return updated.length > 0;
    },
    async listReadyChunks(workspaceId, documentIds) {
      if (documentIds.length === 0) return [];
      return db
        .select({
          ...getColumns(knowledgeChunk),
          documentTitle: knowledgeDocument.title,
          documentVersion: knowledgeDocument.version,
        })
        .from(knowledgeChunk)
        .innerJoin(knowledgeDocument, eq(knowledgeDocument.id, knowledgeChunk.documentId))
        .where(
          and(
            eq(knowledgeDocument.workspaceId, workspaceId),
            eq(knowledgeDocument.status, "ready"),
            inArray(knowledgeDocument.id, documentIds),
          ),
        )
        .orderBy(knowledgeChunk.documentId, knowledgeChunk.sequence);
    },
    async findPackage(id) {
      const [found] = await db
        .select({
          id: knowledgePackage.id,
          title: knowledgePackage.title,
          allSchools: knowledgePackage.allSchools,
          updatedAt: knowledgePackage.updatedAt,
        })
        .from(knowledgePackage)
        .where(eq(knowledgePackage.id, id))
        .limit(1);
      return found;
    },
    async setPackageAllSchools(id, allSchools, userId) {
      const updated = await db
        .update(knowledgePackage)
        .set({ allSchools, updatedBy: userId })
        .where(eq(knowledgePackage.id, id))
        .returning({ id: knowledgePackage.id });
      return updated.length > 0;
    },
    async replaceProcessElements(documentId, elements) {
      const inserts = [];
      for (let start = 0; start < elements.length; start += ELEMENT_ROWS_PER_INSERT) {
        inserts.push(
          db.insert(processElement).values(elements.slice(start, start + ELEMENT_ROWS_PER_INSERT)),
        );
      }
      await db.batch([
        db.delete(processElement).where(eq(processElement.documentId, documentId)),
        ...inserts,
      ]);
    },
    async listProcessElements(workspaceId, documentId) {
      if (!(await ownsDocument(db, workspaceId, documentId))) return [];
      return db
        .select()
        .from(processElement)
        .where(eq(processElement.documentId, documentId))
        .orderBy(asc(processElement.sequence));
    },
    async updateProcessElement(workspaceId, documentId, elementId, changes) {
      if (!(await ownsDocument(db, workspaceId, documentId))) return false;
      const updated = await db
        .update(processElement)
        .set(changes)
        .where(
          and(eq(processElement.documentId, documentId), eq(processElement.elementId, elementId)),
        )
        .returning({ elementId: processElement.elementId });
      return updated.length > 0;
    },
  };
}
