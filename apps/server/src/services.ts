import { createFixtureSchoolAi, createSchoolAi, type SchoolAi } from "@nemu/ai/school/runtime";
import type { DocumentFileStore, InboxFileStore, SchoolServices } from "@nemu/api/context";
import { createStoredAlurSekolahConnector } from "@nemu/api/modules/alursekolah/connector";
import { createSecretCipher, type SecretCipher } from "@nemu/api/modules/integrations/cipher";
import { createIntegrationSecretRepository } from "@nemu/api/modules/integrations/repository";
import { createRegistrySchoolDirectory } from "@nemu/api/modules/school/registry-directory";
import { createSchoolRepository } from "@nemu/api/modules/school/repository";
import { createWorkspaceRepository } from "@nemu/api/modules/workspaces/repository";
import { getDemoDate } from "@nemu/api/modules/workspaces/service";
import { createAuth as createConfiguredAuth } from "@nemu/auth";
import { type Database, createDb } from "@nemu/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}

export function getWorkspaceDemoDate(db: Database, workspaceId: string): Promise<string> {
  return getDemoDate(createWorkspaceRepository(db), workspaceId, ENV.NEMU_DEMO_DATE);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}

export function createDocumentFileStore(): DocumentFileStore {
  return {
    async put(key, body, contentType) {
      await ENV.DOCUMENTS.put(key, body, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await ENV.DOCUMENTS.get(key);
      return object ? object.arrayBuffer() : null;
    },
    async delete(key) {
      await ENV.DOCUMENTS.delete(key);
    },
  };
}

function createInboxFileStore(): InboxFileStore {
  return {
    async put(key, body, contentType) {
      await ENV.INBOX.put(key, body, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await ENV.INBOX.get(key);
      return object ? object.arrayBuffer() : null;
    },
    async delete(key) {
      await ENV.INBOX.delete(key);
    },
    async list(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await ENV.INBOX.list({ prefix, cursor });
        keys.push(...page.objects.map((object) => object.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
  };
}

// Without a key every model-backed school call fails clearly; deterministic ones still work.
function createKeylessSchoolAi(): SchoolAi {
  const missing = async (): Promise<never> => {
    throw new Error("OPENROUTER_API_KEY is not set; set it or use NEMU_RESPONDER=fixture");
  };
  return {
    readGradePhoto: missing,
    parseGradeExcel: (input) => createFixtureSchoolAi().parseGradeExcel(input),
    explainError: missing,
    answerGrounded: missing,
    suggestSymptoms: missing,
    matchSymptom: missing,
    explainProcess: missing,
    extractSlots: missing,
    compileProcedure: missing,
    transcribe: missing,
    synthesize: missing,
  };
}

function createSchoolAiFromEnv(): SchoolAi {
  if (ENV.NEMU_RESPONDER === "fixture") return createFixtureSchoolAi();
  if (!ENV.OPENROUTER_API_KEY) return createKeylessSchoolAi();
  return createSchoolAi({
    apiKey: ENV.OPENROUTER_API_KEY,
    zdr: String(ENV.OPENROUTER_ZDR) === "true",
    models: {
      readA: ENV.OPENROUTER_SCHOOL_READ_A_MODEL,
      readB: ENV.OPENROUTER_SCHOOL_READ_B_MODEL,
      reread: ENV.OPENROUTER_SCHOOL_REREAD_MODEL,
      text: ENV.OPENROUTER_SCHOOL_TEXT_MODEL,
      transcription: ENV.OPENROUTER_STT_MODEL,
      speech: ENV.OPENROUTER_TTS_MODEL ?? "",
      speechVoice: ENV.OPENROUTER_TTS_VOICE ?? "",
    },
  });
}

/** WS-07 settings are sealed with this; an empty INTEGRATION_SECRETS_KEY fails every save and read clearly. */
export function createIntegrationSecretCipher(): SecretCipher {
  return createSecretCipher(ENV.INTEGRATION_SECRETS_KEY ?? "");
}

/**
 * Nemu school services. The directory reads the teachers and contacts registered in WS-06;
 * AlurSekolah is reached with the base URL and key Admin Javan stored in WS-07.
 */
export function createSchoolServices(db: Database): SchoolServices {
  return {
    ai: createSchoolAiFromEnv(),
    directory: createRegistrySchoolDirectory(createSchoolRepository(db)),
    inbox: createInboxFileStore(),
    alurSekolah: createStoredAlurSekolahConnector({
      secrets: createIntegrationSecretRepository(db),
      cipher: createIntegrationSecretCipher(),
    }),
  };
}
