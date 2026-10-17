import { createJevDecider, createOpenRouterAnswerGenerator, runNemu } from "@nemu/ai";
import {
  DEMO_HOLIDAYS_2026,
  DEMO_KNOWLEDGE_CHUNKS,
  DEMO_REQUIRED_DOCUMENTS,
  DEMO_SBM_ROWS,
  DEMO_USER_PROFILE,
} from "@nemu/ai/demo";
import type { DocumentFileStore, NemuService } from "@nemu/api/context";
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
  };
}

export function createNemuService(): NemuService {
  const jevDecider = createJevDecider({
    apiKey: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_JEV_MODEL,
  });
  const answerGenerator = createOpenRouterAnswerGenerator({
    apiKey: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_GENERATOR_MODEL,
    reasoningEffort: getReasoningEffort(),
  });

  return {
    async respond(request, authenticatedUserId) {
      return runNemu(request, {
        userProfile: {
          ...DEMO_USER_PROFILE,
          userId: authenticatedUserId,
        },
        processContext: request.process_context,
        knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
        sbmRows: DEMO_SBM_ROWS,
        holidays: DEMO_HOLIDAYS_2026,
        requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
        currentDate: ENV.NEMU_DEMO_DATE,
        jevDecider,
        answerGenerator,
      });
    },
  };
}
