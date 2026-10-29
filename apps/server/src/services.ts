import { createJevDecider, createOpenRouterAnswerGenerator, runNemu } from "@nemu/ai";
import type { DocumentFileStore, NemuService } from "@nemu/api/context";
import { createFixtureNemuService } from "@nemu/api/modules/chat/fixture-responder";
import {
  createNemuRuntimeDataSource,
  createRuntimeNemuService,
} from "@nemu/api/modules/chat/nemu-data-source";
import { createNemuProfileRepository } from "@nemu/api/modules/chat/profile-repository";
import { createDocumentRepository } from "@nemu/api/modules/documents/repository";
import { createReferenceTableRepository } from "@nemu/api/modules/reference-tables/repository";
import { createSlaClaimRepository } from "@nemu/api/modules/sla-claims/repository";
import { getSlaClaimContext } from "@nemu/api/modules/sla-claims/service";
import { createAuth as createConfiguredAuth } from "@nemu/auth";
import { type Database, createDb, eq } from "@nemu/db";
import { workspace } from "@nemu/db/schema/workspace";

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

export async function getWorkspaceDemoDate(
  db: Database,
  workspaceId: string,
  fallback = ENV.NEMU_DEMO_DATE,
): Promise<string> {
  const [record] = await db
    .select({ demoDate: workspace.demoDate })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);
  return record?.demoDate ?? fallback;
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
