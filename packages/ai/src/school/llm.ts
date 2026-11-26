import { fetchJson } from "../http.js";

/** One part of a model input: text, or an image as a data URL. */
export type LlmContent = { type: "text"; text: string } | { type: "image"; dataUrl: string };

export type JsonCallRequest<T> = {
  instructions: string;
  content: readonly LlmContent[];
  schemaName: string;
  /** Strict JSON schema: every property required, additionalProperties false. */
  schema: Record<string, unknown>;
  parse: (value: unknown) => T;
  maxOutputTokens?: number;
};

/** A structured model call. Tests pass a fake; production uses `createOpenRouterJsonCaller`. */
export type JsonCall = <T>(request: JsonCallRequest<T>) => Promise<T>;

export type OpenRouterJsonCallerConfig = {
  apiKey: string;
  model: string;
  /** Omit for models without a reasoning setting. */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  /** Restrict routing to zero-data-retention endpoints (decision D1). */
  zdr?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
};

type ResponsesApiOutput = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
};

export function extractResponsesText(response: unknown): string {
  const parsed = (response ?? {}) as ResponsesApiOutput;
  if (typeof parsed.output_text === "string" && parsed.output_text) return parsed.output_text;
  for (const output of parsed.output ?? []) {
    for (const part of output.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text) {
        return part.text;
      }
    }
  }
  throw new Error("OpenRouter Responses API did not contain output text");
}

function toResponsesContent(content: readonly LlmContent[]): Array<Record<string, unknown>> {
  return content.map((part) =>
    part.type === "text"
      ? { type: "input_text", text: part.text }
      : { type: "input_image", image_url: part.dataUrl, detail: "high" },
  );
}

/**
 * Structured calls through OpenRouter's Responses API.
 * Data collection is always denied; prompts and outputs are never logged by Nemu.
 */
export function createOpenRouterJsonCaller(config: OpenRouterJsonCallerConfig): JsonCall {
  return async (request) => {
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
          ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
          max_output_tokens: request.maxOutputTokens ?? config.maxOutputTokens ?? 2_000,
          instructions: request.instructions,
          input: [{ role: "user", content: toResponsesContent(request.content) }],
          text: {
            format: {
              type: "json_schema",
              name: request.schemaName,
              strict: true,
              schema: request.schema,
            },
          },
          provider: {
            require_parameters: true,
            data_collection: "deny",
            ...(config.zdr ? { zdr: true } : {}),
          },
        }),
      },
      { fetchImplementation: config.fetchImplementation, timeoutMs: config.timeoutMs ?? 60_000 },
    );
    return request.parse(JSON.parse(extractResponsesText(response)));
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function imageDataUrl(bytes: Uint8Array, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}
