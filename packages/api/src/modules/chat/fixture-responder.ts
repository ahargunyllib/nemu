import type { NemuRequest, NemuResponse } from "@nemu/contracts";
import {
  k2ApprovalRequest,
  k2ApprovalResponse,
  k2CompensationRequest,
  k2CompensationResponse,
  k2SlaContractRequest,
  k2SlaContractResponse,
  k2SlaRequest,
  k2SlaResponse,
  k2SlaReturnRequest,
  k2SlaReturnResponse,
  momentOneFollowUpRequest,
  momentOneFollowUpResponse,
  momentOneRequest,
  momentOneResponse,
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
  { request: momentOneFollowUpRequest, response: momentOneFollowUpResponse },
  { request: momentTwoRequest, response: momentTwoResponse },
  { request: momentThreeRequest, response: momentThreeResponse },
  { request: momentThreeFollowUpRequest, response: momentThreeFollowUpResponse },
  { request: k2SlaRequest, response: k2SlaResponse },
  // With the same prompt, return must precede contract so one shared return target wins the tie
  // after the contract button disappears; the contract fixture still wins when both are present.
  { request: k2SlaReturnRequest, response: k2SlaReturnResponse },
  { request: k2SlaContractRequest, response: k2SlaContractResponse },
  { request: k2CompensationRequest, response: k2CompensationResponse },
  { request: k2ApprovalRequest, response: k2ApprovalResponse },
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
    ringkas: "Mode fixture hanya mengenali pertanyaan demo K1 dan K2 yang terdaftar.",
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
