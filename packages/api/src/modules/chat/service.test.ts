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
import { answerChat } from "./service";

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
    expect(entries[0]?.result).toBe("✖ refuse responses cannot contain actions\n  → at actions");
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
