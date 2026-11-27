import { createFixtureSchoolAi, type SchoolAi } from "@nemu/ai/school/runtime";

import type { Context, DocumentFileStore, InboxFileStore } from "../context";
import { createStoredAlurSekolahConnector } from "../modules/alursekolah/connector";
import { createSecretCipher } from "../modules/integrations/cipher";
import { createIntegrationSecretRepository } from "../modules/integrations/repository";
import { saveSecret } from "../modules/integrations/service";
import { createDemoSchoolDirectory } from "../modules/school/directory";
import {
  FAKE_ALURSEKOLAH_KEY,
  FAKE_ALURSEKOLAH_URL,
  type FakeAlurSekolah,
  createFakeAlurSekolah,
} from "./alursekolah";
import { createMigratedDb } from "./d1";

export const TEST_INTEGRATION_SECRETS_KEY = "test-integration-secrets-key-0123456789";

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
  /** The network behind `school.alurSekolah`; WS-07 settings decide whether it is reached. */
  alurSekolahFake: FakeAlurSekolah;
};

/** A request context for Bu Siti (W-SEKOLAH, seeded), over a migrated in-memory D1 and the offline AI. */
export async function createSchoolContext(
  user: { id: string; role: string; workspaceId: string } = {
    id: "siti",
    role: "guru",
    workspaceId: "W-SEKOLAH",
  },
  ai: SchoolAi = createFixtureSchoolAi(),
  alurSekolahFake: FakeAlurSekolah = createFakeAlurSekolah(),
): Promise<SchoolTestContext> {
  const db = await createMigratedDb();
  const secretCipher = createSecretCipher(TEST_INTEGRATION_SECRETS_KEY);
  const alurSekolah = createStoredAlurSekolahConnector(
    { secrets: createIntegrationSecretRepository(db), cipher: secretCipher },
    alurSekolahFake.fetch,
  );
  return {
    db,
    session: { session: {}, user } as unknown as Context["session"],
    documentFiles: createMemoryFileStore(),
    school: {
      ai,
      directory: createDemoSchoolDirectory(),
      inbox: createMemoryFileStore(),
      alurSekolah,
    },
    secretCipher,
    alurSekolahFake,
    demoDate: "2026-12-01",
  };
}

/** What Admin Javan does in WS-07: store the AlurSekolah base URL and key for the context's school. */
export async function connectAlurSekolah(
  context: SchoolTestContext,
  values: { baseUrl?: string; apiKey?: string } = {},
) {
  const deps = {
    secrets: createIntegrationSecretRepository(context.db),
    cipher: context.secretCipher,
  };
  const workspaceId = context.session?.user.workspaceId ?? "W-SEKOLAH";
  for (const [name, value] of [
    ["alursekolah_base_url", values.baseUrl ?? FAKE_ALURSEKOLAH_URL],
    ["alursekolah_api_key", values.apiKey ?? FAKE_ALURSEKOLAH_KEY],
  ] as const) {
    await saveSecret(deps, { workspaceId, updatedBy: "javan", name, value });
  }
}
