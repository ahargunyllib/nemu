import { createFixtureSchoolAi, type SchoolAi } from "@nemu/ai/school/runtime";

import type { Context, DocumentFileStore, InboxFileStore } from "../context";
import { createDemoSchoolDirectory } from "../modules/school/directory";
import { createMigratedDb } from "./d1";

export function createMemoryFileStore(): InboxFileStore & { objects: Map<string, ArrayBuffer> } {
  const objects = new Map<string, ArrayBuffer>();
  return {
    objects,
    async put(key, body) {
      objects.set(key, body.slice(0));
    },
    async get(key) {
      return objects.get(key)?.slice(0) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
  };
}

export type SchoolTestContext = Context & {
  documentFiles: DocumentFileStore & { objects: Map<string, ArrayBuffer> };
  school: Context["school"] & { inbox: ReturnType<typeof createMemoryFileStore> };
};

/** A request context for Bu Siti (W-SEKOLAH, seeded), over a migrated in-memory D1 and the offline AI. */
export async function createSchoolContext(
  user: { id: string; role: string; workspaceId: string } = {
    id: "siti",
    role: "guru",
    workspaceId: "W-SEKOLAH",
  },
  ai: SchoolAi = createFixtureSchoolAi(),
): Promise<SchoolTestContext> {
  const db = await createMigratedDb();
  return {
    db,
    session: { session: {}, user } as unknown as Context["session"],
    nemu: {
      respond: async () => {
        throw new Error("not used");
      },
    },
    documentFiles: createMemoryFileStore(),
    school: { ai, directory: createDemoSchoolDirectory(), inbox: createMemoryFileStore() },
    demoDate: "2026-12-01",
  };
}
