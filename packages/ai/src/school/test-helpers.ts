import type { JsonCall, JsonCallRequest } from "./llm.js";

export type RecordedCall = {
  schemaName: string;
  instructions: string;
  content: JsonCallRequest<unknown>["content"];
};

/**
 * A fake model: answers by schema name and records every request, so tests can assert what was
 * (and wasn't) sent to a provider. Responses go through the real `parse`.
 */
type FakeAnswer =
  | ((request: JsonCallRequest<unknown>) => unknown)
  | Record<string, unknown>
  | readonly unknown[]
  | string
  | number
  | boolean
  | null;

export function fakeJsonCall(
  answers: Record<string, FakeAnswer>,
): JsonCall & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const call = (async <T>(request: JsonCallRequest<T>): Promise<T> => {
    calls.push({
      schemaName: request.schemaName,
      instructions: request.instructions,
      content: request.content,
    });
    const answer = answers[request.schemaName];
    if (answer === undefined) throw new Error(`No fake answer for ${request.schemaName}`);
    const value =
      typeof answer === "function"
        ? (answer as (r: JsonCallRequest<unknown>) => unknown)(request as JsonCallRequest<unknown>)
        : answer;
    return request.parse(structuredClone(value));
  }) as JsonCall & { calls: RecordedCall[] };
  call.calls = calls;
  return call;
}

export function textOf(content: RecordedCall["content"]): string {
  return content.map((part) => (part.type === "text" ? part.text : "[image]")).join("\n");
}
