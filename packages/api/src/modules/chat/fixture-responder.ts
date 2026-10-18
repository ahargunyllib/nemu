import type { NemuRequest, NemuResponse } from "@nemu/contracts";
import {
  momentOneRequest,
  momentOneResponse,
  momentOneScheduleRequest,
  momentOneScheduleResponse,
  momentThreeFollowUpRequest,
  momentThreeFollowUpResponse,
  momentThreeRequest,
  momentThreeResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";

import type { NemuService } from "../../context";

type Fixture = { request: NemuRequest; response: NemuResponse };

// Order breaks ties: Momen 3 shares its prompt with its follow-up, and the
// follow-up wins only when the request carries more of the follow-up's elements.
const FIXTURES: readonly Fixture[] = [
  { request: momentOneRequest, response: momentOneResponse },
  { request: momentOneScheduleRequest, response: momentOneScheduleResponse },
  { request: momentTwoRequest, response: momentTwoResponse },
  { request: momentThreeRequest, response: momentThreeResponse },
  { request: momentThreeFollowUpRequest, response: momentThreeFollowUpResponse },
];

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function countSharedElements(fixture: NemuRequest, request: NemuRequest): number {
  const requestIds = new Set(request.elements.map((element) => element.nemu_id));
  return fixture.elements.filter((element) => requestIds.has(element.nemu_id)).length;
}

const unknownPromptResponse = {
  status: "clarify",
  answer: {
    ringkas: "Mode fixture hanya mengenali pertanyaan demo Momen 1–3. Coba salah satunya.",
    detail: [...new Set(FIXTURES.map((fixture) => fixture.request.prompt))]
      .map((prompt) => `• ${prompt}`)
      .join("\n"),
  },
  citations: [],
  calc: [],
  actions: [],
  warnings: [],
} satisfies NemuResponse;

export function findFixtureResponse(request: NemuRequest): NemuResponse {
  const prompt = normalizePrompt(request.prompt);
  let best: { fixture: Fixture; shared: number } | undefined;

  for (const fixture of FIXTURES) {
    if (normalizePrompt(fixture.request.prompt) !== prompt) continue;
    const shared = countSharedElements(fixture.request, request);
    if (!best || shared > best.shared) best = { fixture, shared };
  }

  return best?.fixture.response ?? unknownPromptResponse;
}

/** Answers from the Momen fixtures without calling OpenRouter (ADR-0001). */
export function createFixtureNemuService(): NemuService {
  return {
    async respond(request) {
      return findFixtureResponse(request);
    },
  };
}
