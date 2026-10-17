import type { Calculation, NemuRequest, ProcessContext } from "@nemu/contracts";
import { z } from "zod";

import { fetchJson } from "./http.js";
import type { JevDecision } from "./jev.js";
import type { RankedKnowledgeChunk } from "./knowledge.js";
import { NEMU_SYSTEM_PROMPT } from "./prompt.js";

export type NemuUserProfile = {
  userId: string;
  name: string;
  grade: string;
  unit: string;
  province: string;
};

export type GeneratedAnswer = {
  status: "answer" | "clarify" | "refuse";
  ringkas: string;
  detail: string;
  citationIds: string[];
  warnings: string[];
};

export type AnswerGenerationInput = {
  request: NemuRequest;
  userProfile: NemuUserProfile;
  processContext?: ProcessContext;
  evidence: readonly RankedKnowledgeChunk[];
  calculations: readonly Calculation[];
  decision: JevDecision;
  missingDocuments: readonly string[];
};

export type AnswerGenerator = (input: AnswerGenerationInput) => Promise<GeneratedAnswer>;

export type OpenRouterClientConfig = {
  apiKey: string;
  model: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxOutputTokens?: number;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
};

const generatedAnswerSchema = z
  .object({
    status: z.enum(["answer", "clarify", "refuse"]),
    ringkas: z.string().min(1).max(500),
    detail: z.string().max(6_000),
    citation_ids: z.array(z.string().min(1).max(200)).max(20),
    warnings: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

const responsesApiSchema = z
  .object({
    output_text: z.string().optional(),
    output: z
      .array(
        z
          .object({
            content: z
              .array(
                z
                  .object({
                    type: z.string(),
                    text: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const GENERATED_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answer", "clarify", "refuse"] },
    ringkas: { type: "string" },
    detail: { type: "string" },
    citation_ids: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["status", "ringkas", "detail", "citation_ids", "warnings"],
  additionalProperties: false,
} as const;

function normalizeImageDataUrl(value: string): string {
  if (/^data:image\/(?:png|jpe?g);base64,/u.test(value)) {
    return value;
  }
  return `data:image/png;base64,${value}`;
}

function extractOutputText(response: unknown): string {
  const parsedResponse = responsesApiSchema.parse(response);
  if (parsedResponse.output_text) {
    return parsedResponse.output_text;
  }

  for (const output of parsedResponse.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new Error("OpenRouter Responses API did not contain output text");
}

export function createOpenRouterAnswerGenerator(config: OpenRouterClientConfig): AnswerGenerator {
  return async (input) => {
    const content: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: JSON.stringify({
          task: "Produce Nemu's user-facing response from the trusted and untrusted data below.",
          user_prompt: input.request.prompt,
          current_url: input.request.url,
          user_profile: input.userProfile,
          process_context: input.processContext ?? null,
          visible_elements: input.request.elements.map(({ nemu_id, label, role, visible }) => ({
            nemu_id,
            label,
            role,
            visible,
          })),
          decision: input.decision,
          deterministic_calculations: input.calculations,
          missing_documents: input.missingDocuments,
          evidence: input.evidence.map((chunk) => ({
            citation_id: chunk.id,
            doc_id: chunk.docId,
            title: chunk.title,
            version: chunk.version,
            article: chunk.article ?? null,
            page: chunk.page ?? null,
            text: chunk.text,
          })),
        }),
      },
    ];

    if (input.request.screenshot_crop) {
      content.push({
        type: "input_image",
        image_url: normalizeImageDataUrl(input.request.screenshot_crop),
        detail: "original",
      });
    }

    const response = await fetchJson(
      "https://openrouter.ai/api/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          reasoning: { effort: config.reasoningEffort ?? "low" },
          max_output_tokens: config.maxOutputTokens ?? 2_000,
          instructions: NEMU_SYSTEM_PROMPT,
          input: [{ role: "user", content }],
          text: {
            format: {
              type: "json_schema",
              name: "nemu_answer",
              strict: true,
              schema: GENERATED_ANSWER_JSON_SCHEMA,
            },
          },
        }),
      },
      {
        fetchImplementation: config.fetchImplementation,
        timeoutMs: config.timeoutMs,
      },
    );

    const generatedAnswer = generatedAnswerSchema.parse(JSON.parse(extractOutputText(response)));
    return {
      status: generatedAnswer.status,
      ringkas: generatedAnswer.ringkas,
      detail: generatedAnswer.detail,
      citationIds: generatedAnswer.citation_ids,
      warnings: generatedAnswer.warnings,
    };
  };
}
