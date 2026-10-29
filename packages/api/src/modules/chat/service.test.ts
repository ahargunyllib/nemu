import {
  momentOneRequest,
  momentOneResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { describe, expect, it } from "vite-plus/test";

import type { NemuService } from "../../context";
import { createFixtureNemuService } from "./fixture-responder";
import type { ChatLogRepository, NewChatLogRecord } from "./repository";
import { answerChat, resolveChatProcessContext } from "./service";

const SIGNED_IN_USER = "user-rina";

function createFakes(nemu: NemuService = createFixtureNemuService()) {
  const entries: NewChatLogRecord[] = [];
  const chatLog: ChatLogRepository = {
    async insert(record) {
      entries.push(record);
    },
    async listNewest() {
      return [];
    },
  };
  return { deps: { nemu, chatLog }, entries };
}

describe("answerChat", () => {
  it("writes one Chat Log entry with the prompt, sources, actions and result", async () => {
    const { deps, entries } = createFakes();

    const response = await answerChat(deps, momentOneRequest, SIGNED_IN_USER);

    expect(response).toEqual(momentOneResponse);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: SIGNED_IN_USER,
      sessionId: momentOneRequest.session_id,
      url: momentOneRequest.url,
      prompt: momentOneRequest.prompt,
      hasAreaCrop: false,
      status: momentOneResponse.status,
      result: momentOneResponse.answer.ringkas,
      citations: momentOneResponse.citations,
      actions: momentOneResponse.actions,
    });
  });

  it("logs and answers as the signed-in user, not the user_id in the request", async () => {
    const respondedAs: string[] = [];
    const fixture = createFixtureNemuService();
    const { deps, entries } = createFakes({
      async respond(request, authenticatedUserId) {
        respondedAs.push(request.user_id ?? "", authenticatedUserId);
        return fixture.respond(request, authenticatedUserId);
      },
    });

    await answerChat(deps, { ...momentOneRequest, user_id: "someone-else" }, SIGNED_IN_USER);

    expect(respondedAs).toEqual([SIGNED_IN_USER, SIGNED_IN_USER]);
    expect(entries[0]?.userId).toBe(SIGNED_IN_USER);
  });

  it("records that an Area Crop was attached without storing the image", async () => {
    const { deps, entries } = createFakes();
    const crop = momentTwoRequest.screenshot_crop;
    if (!crop) throw new Error("The Momen 2 fixture should carry an Area Crop");

    await answerChat(deps, momentTwoRequest, SIGNED_IN_USER);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ hasAreaCrop: true, status: momentTwoResponse.status });
    expect(JSON.stringify(entries[0])).not.toContain(crop);
  });

  it("writes an error entry when the Responder fails, then rethrows", async () => {
    const { deps, entries } = createFakes({
      async respond() {
        throw new Error("OPENROUTER_API_KEY is not set");
      },
    });

    await expect(answerChat(deps, momentOneRequest, SIGNED_IN_USER)).rejects.toThrow(
      "OPENROUTER_API_KEY is not set",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: "error",
      result: "OPENROUTER_API_KEY is not set",
      citations: [],
      actions: [],
    });
  });

  it("logs an invalid Responder reply as an error instead of returning it", async () => {
    const { deps, entries } = createFakes({
      async respond() {
        return { ...momentOneResponse, status: "refuse" };
      },
    });

    await expect(answerChat(deps, momentOneRequest, SIGNED_IN_USER)).rejects.toThrow();
    expect(entries.map((entry) => entry.status)).toEqual(["error"]);
  });

  it("still answers when writing the Chat Log fails", async () => {
    const { deps } = createFakes();
    deps.chatLog.insert = async () => {
      throw new Error("D1 is unavailable");
    };

    await expect(answerChat(deps, momentOneRequest, SIGNED_IN_USER)).resolves.toEqual(
      momentOneResponse,
    );
  });
});

describe("resolveChatProcessContext", () => {
  it("derives a Telco claim context from the signed-in workspace and assigned route", async () => {
    const context = await resolveChatProcessContext(
      {
        loadTravel: async () => undefined,
        findSlaTaskByService: async () => undefined,
        findSlaTaskByInvoice: async () => undefined,
        listSlaTasks: async () => [
          {
            id: "T-0007-1",
            workspaceId: "W-TELKO",
            claimId: "KLM-2610-0007",
            name: "Registrasi Klaim",
            assigneeId: "U-101",
            createdAt: "2026-10-08T14:20:00+07:00",
            reviewDueOn: "2026-10-15",
            status: "OPEN",
          },
        ],
      },
      { id: "U-101", workspaceId: "W-TELKO" },
      "https://demo.example/sla-claims/KLM-2610-0007",
    );

    expect(context).toEqual({
      instance_id: "KLM-2610-0007",
      workspace: { id: "W-TELKO", domain: "telco_sla" },
      active_task: "Registrasi Klaim",
      status: "OPEN",
      uploaded_documents: [],
    });
  });

  it("rejects a Telco claim route not assigned to the signed-in user", async () => {
    await expect(
      resolveChatProcessContext(
        {
          loadTravel: async () => undefined,
          findSlaTaskByService: async () => undefined,
          findSlaTaskByInvoice: async () => undefined,
          listSlaTasks: async () => [
            {
              id: "T-0007-1",
              workspaceId: "W-TELKO",
              claimId: "KLM-2610-0007",
              name: "Registrasi Klaim",
              assigneeId: "someone-else",
              createdAt: "2026-10-08T14:20:00+07:00",
              reviewDueOn: "2026-10-15",
              status: "OPEN",
            },
          ],
        },
        { id: "U-101", workspaceId: "W-TELKO" },
        "https://demo.example/sla-claims/KLM-2610-0007",
      ),
    ).rejects.toThrow("not assigned");
  });

  it("resolves CRM pages by their service instead of arbitrary task order", async () => {
    const context = await resolveChatProcessContext(
      {
        loadTravel: async () => undefined,
        listSlaTasks: async () => [],
        findSlaTaskByService: async (_workspaceId, actorId, serviceId) =>
          actorId === "U-101" && serviceId === "TN-ENT-003"
            ? {
                id: "T-0011-1",
                workspaceId: "W-TELKO",
                claimId: "KLM-2610-0011",
                name: "Cocokkan Layanan & Kontrak",
                assigneeId: "U-101",
                createdAt: "2026-10-08T15:45:00+07:00",
                reviewDueOn: null,
                status: "OPEN",
              }
            : undefined,
        findSlaTaskByInvoice: async () => undefined,
      },
      { id: "U-101", workspaceId: "W-TELKO" },
      "https://demo.example/crm/TN-ENT-003",
    );

    expect(context?.instance_id).toBe("KLM-2610-0011");
  });
});
