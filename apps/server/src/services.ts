import { createJevDecider, createOpenRouterAnswerGenerator, runNemu } from "@nemu/ai";
import { createFixtureSchoolAi, createSchoolAi, type SchoolAi } from "@nemu/ai/school/runtime";
import type {
  DocumentFileStore,
  InboxFileStore,
  NemuService,
  SchoolServices,
} from "@nemu/api/context";
import { createFixtureNemuService } from "@nemu/api/modules/chat/fixture-responder";
import {
  createNemuRuntimeDataSource,
  createRuntimeNemuService,
} from "@nemu/api/modules/chat/nemu-data-source";
import { createNemuProfileRepository } from "@nemu/api/modules/chat/profile-repository";
import { createDocumentRepository } from "@nemu/api/modules/documents/repository";
import { createReferenceTableRepository } from "@nemu/api/modules/reference-tables/repository";
import { createRuleSourceRepository } from "@nemu/api/modules/rule-sources/repository";
import { createRegistrySchoolDirectory } from "@nemu/api/modules/school/registry-directory";
import { createSchoolRepository } from "@nemu/api/modules/school/repository";
import { createSlaClaimRepository } from "@nemu/api/modules/sla-claims/repository";
import { getSlaClaimContext } from "@nemu/api/modules/sla-claims/service";
import { createWorkspaceRepository } from "@nemu/api/modules/workspaces/repository";
import { getDemoDate } from "@nemu/api/modules/workspaces/service";
import { createAuth as createConfiguredAuth } from "@nemu/auth";
import { type Database, createDb } from "@nemu/db";

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

function getReasoningEffort(): (typeof REASONING_EFFORTS)[number] {
  const configuredEffort = ENV.OPENROUTER_REASONING_EFFORT;
  switch (configuredEffort) {
    case "low":
    case "medium":
    case "high":
    case "xhigh":
    case "max":
      return configuredEffort;
    default:
      throw new Error(`Unsupported OpenRouter reasoning effort: ${configuredEffort}`);
  }
}

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

export function createNemuService(db: Database): NemuService {
  return ENV.NEMU_RESPONDER === "fixture" ? createFixtureNemuService() : createAiNemuService(db);
}

function createAiNemuService(db: Database): NemuService {
  if (!ENV.OPENROUTER_API_KEY) {
    return {
      async respond() {
        throw new Error("OPENROUTER_API_KEY is not set; set it or use NEMU_RESPONDER=fixture");
      },
    };
  }

  const jevDecider = createJevDecider({
    apiKey: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_JEV_MODEL,
  });
  const answerGenerator = createOpenRouterAnswerGenerator({
    apiKey: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_GENERATOR_MODEL,
    reasoningEffort: getReasoningEffort(),
  });

  const slaClaims = createSlaClaimRepository(db);
  const dataSource = createNemuRuntimeDataSource({
    profiles: createNemuProfileRepository(db),
    documents: createDocumentRepository(db),
    tables: createReferenceTableRepository(db),
    ruleSources: createRuleSourceRepository(db),
    slaClaims: {
      loadContext: (workspaceId, claimId) => getSlaClaimContext(slaClaims, workspaceId, claimId),
    },
    currentDate: (workspaceId) => getWorkspaceDemoDate(db, workspaceId),
  });
  return createRuntimeNemuService(dataSource, {
    async respond(request, snapshot) {
      return runNemu(request, {
        ...snapshot,
        jevDecider,
        answerGenerator,
      });
    },
  });
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

/** Nemu school services. The directory reads the teachers and contacts registered in WS-06. */
export function createSchoolServices(db: Database): SchoolServices {
  return {
    ai: createSchoolAiFromEnv(),
    directory: createRegistrySchoolDirectory(createSchoolRepository(db)),
    inbox: createInboxFileStore(),
  };
}
