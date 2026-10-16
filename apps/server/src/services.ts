import { createJevDecider, createOpenAIAnswerGenerator, runNemu } from "@nemu/ai";
import {
  DEMO_HOLIDAYS_2026,
  DEMO_KNOWLEDGE_CHUNKS,
  DEMO_REQUIRED_DOCUMENTS,
  DEMO_SBM_ROWS,
  DEMO_USER_PROFILE,
} from "@nemu/ai/demo";
import type { NemuService } from "@nemu/api/context";
import { createAuth as createConfiguredAuth } from "@nemu/auth";
import { type Database, createDb } from "@nemu/db";

const OPENAI_REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

function getReasoningEffort(): (typeof OPENAI_REASONING_EFFORTS)[number] {
  const configuredEffort = ENV.OPENAI_REASONING_EFFORT;
  if (!OPENAI_REASONING_EFFORTS.some((effort) => effort === configuredEffort)) {
    throw new Error(`Unsupported OpenAI reasoning effort: ${configuredEffort}`);
  }
  return configuredEffort;
}

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}

export function createNemuService(): NemuService {
  const jevDecider = createJevDecider({
    apiKey: ENV.TYPESAFE_API_KEY,
    model: ENV.TYPESAFE_MODEL,
  });
  const answerGenerator = createOpenAIAnswerGenerator({
    apiKey: ENV.OPENAI_API_KEY,
    model: ENV.OPENAI_MODEL,
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
