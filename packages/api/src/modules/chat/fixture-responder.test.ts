import { nemuResponseSchema } from "@nemu/contracts";
import {
  k2ApprovalRequest,
  k2ApprovalResponse,
  k2CompensationRequest,
  k2CompensationResponse,
  k2RegistrationRequest,
  k2RegistrationResponse,
  k2SlaContractRequest,
  k2SlaContractResponse,
  k2SlaRequest,
  k2SlaResponse,
  k2SlaReturnRequest,
  k2SlaReturnResponse,
  k2TicketsRequest,
  k2TicketsResponse,
  k1StartTravelRequest,
  momentOneJadwalRequest,
  momentOneJadwalResponse,
  momentOneRequest,
  momentOneResponse,
  momentOneFollowUpRequest,
  momentOneFollowUpResponse,
  momentThreeFollowUpRequest,
  momentThreeFollowUpResponse,
  momentThreeRequest,
  momentThreeResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { describe, expect, test } from "vite-plus/test";

import { findFixtureResponse } from "./fixture-responder";

describe("fixture responder", () => {
  test.each([
    ["Momen 1", momentOneRequest, momentOneResponse],
    ["Momen 1 follow-up", momentOneFollowUpRequest, momentOneFollowUpResponse],
    ["Momen 1 on the Jadwal tab", momentOneJadwalRequest, momentOneJadwalResponse],
    [
      "K1-01 on the Jadwal tab",
      { ...momentOneJadwalRequest, prompt: k1StartTravelRequest.prompt },
      momentOneJadwalResponse,
    ],
    ["Momen 2", momentTwoRequest, momentTwoResponse],
    ["Momen 3", momentThreeRequest, momentThreeResponse],
    ["Momen 3 follow-up", momentThreeFollowUpRequest, momentThreeFollowUpResponse],
    ["K2 registration", k2RegistrationRequest, k2RegistrationResponse],
    ["K2 SLA", k2SlaRequest, k2SlaResponse],
    ["K2 SLA contract", k2SlaContractRequest, k2SlaContractResponse],
    ["K2 SLA return", k2SlaReturnRequest, k2SlaReturnResponse],
    ["K2 tickets", k2TicketsRequest, k2TicketsResponse],
    ["K2 compensation", k2CompensationRequest, k2CompensationResponse],
    ["K2 approval refusal", k2ApprovalRequest, k2ApprovalResponse],
  ])("answers the %s prompt with its fixture", (_name, request, response) => {
    expect(findFixtureResponse(request)).toEqual(response);
  });

  test("matches a typed prompt regardless of case, spacing and punctuation", () => {
    const request = {
      ...momentOneRequest,
      prompt: "  saya dapat tugas rapat ke MAKASSAR 3 hari   mulai dari mana ",
      elements: [],
    };

    expect(findFixtureResponse(request)).toEqual(momentOneResponse);
  });

  test("answers Momen 3 with the task click until the task page elements are sent", () => {
    expect(findFixtureResponse({ ...momentThreeFollowUpRequest, elements: [] })).toEqual(
      momentThreeResponse,
    );
  });

  test("asks for a demo prompt when nothing matches, without actions", () => {
    const response = findFixtureResponse({ ...momentOneRequest, prompt: "Berapa kurs dolar?" });

    expect(response.status).toBe("clarify");
    expect(response.actions).toEqual([]);
    expect(nemuResponseSchema.safeParse(response).success).toBe(true);
  });
});
