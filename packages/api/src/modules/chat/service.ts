import {
  type NemuRequest,
  type NemuResponse,
  type ProcessContext,
  nemuResponseSchema,
} from "@nemu/contracts";
import { z } from "zod";

import type { SlaTaskRecord } from "../sla-claims/repository";

import type { NemuService } from "../../context";
import type { ChatLogRepository, NewChatLogRecord } from "./repository";

export type ChatDeps = {
  nemu: NemuService;
  chatLog: ChatLogRepository;
};

export const CHAT_LOG_LIMIT = 200;

type ChatActor = { id: string; workspaceId: string };

type ChatProcessContextDeps = {
  loadTravel(): Promise<ProcessContext | undefined>;
  listSlaTasks(workspaceId: string): Promise<SlaTaskRecord[]>;
  findSlaTaskByService(
    workspaceId: string,
    actorId: string,
    serviceId: string,
  ): Promise<SlaTaskRecord | undefined>;
  findSlaTaskByInvoice(
    workspaceId: string,
    actorId: string,
    invoiceId: string,
  ): Promise<SlaTaskRecord | undefined>;
};

function claimIdFromUrl(pageUrl: string): string | undefined {
  const match = new URL(pageUrl).pathname.match(/\/sla-claims\/([^/]+)\/?$/u);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function operationalRecordFromUrl(
  pageUrl: string,
): { kind: "service" | "invoice"; id: string } | undefined {
  const match = new URL(pageUrl).pathname.match(/\/(crm|noc|billing)\/([^/]+)\/?$/u);
  if (!match?.[1] || !match[2]) return undefined;
  return {
    kind: match[1] === "billing" ? "invoice" : "service",
    id: decodeURIComponent(match[2]),
  };
}

export async function resolveChatProcessContext(
  deps: ChatProcessContextDeps,
  actor: ChatActor,
  pageUrl: string,
): Promise<ProcessContext | undefined> {
  if (actor.workspaceId !== "W-TELKO") return deps.loadTravel();

  const tasks = await deps.listSlaTasks(actor.workspaceId);
  const routeClaimId = claimIdFromUrl(pageUrl);
  const operationalRecord = operationalRecordFromUrl(pageUrl);
  const task = routeClaimId
    ? tasks.find((candidate) => candidate.claimId === routeClaimId)
    : operationalRecord?.kind === "service"
      ? await deps.findSlaTaskByService(actor.workspaceId, actor.id, operationalRecord.id)
      : operationalRecord?.kind === "invoice"
        ? await deps.findSlaTaskByInvoice(actor.workspaceId, actor.id, operationalRecord.id)
        : tasks.find(
            (candidate) => candidate.assigneeId === actor.id && candidate.status !== "SELESAI",
          );
  if (!task || task.assigneeId !== actor.id) {
    throw new Error(`SLA claim ${routeClaimId ?? "task"} is not assigned to user ${actor.id}`);
  }

  return {
    instance_id: task.claimId,
    workspace: { id: actor.workspaceId, domain: "telco_sla" },
    active_task: task.name,
    status: task.status,
    uploaded_documents: [],
  };
}

type ChatOutcome = Pick<NewChatLogRecord, "status" | "result" | "citations" | "actions">;

// Hands the request to the Responder as the signed-in user and writes one Chat Log
// entry for it, including when the Responder fails or returns an invalid response.
export async function answerChat(
  { nemu, chatLog }: ChatDeps,
  request: NemuRequest,
  userId: string,
): Promise<NemuResponse> {
  const startedAt = Date.now();
  const record = (outcome: ChatOutcome) =>
    writeChatLog(chatLog, {
      id: crypto.randomUUID(),
      userId,
      sessionId: request.session_id,
      url: request.url,
      prompt: request.prompt,
      hasAreaCrop: Boolean(request.screenshot_crop),
      durationMs: Date.now() - startedAt,
      ...outcome,
    });

  let response: NemuResponse;
  try {
    response = nemuResponseSchema.parse(
      await nemu.respond({ ...request, user_id: userId }, userId),
    );
  } catch (error) {
    await record({
      status: "error",
      result: describeError(error),
      citations: [],
      actions: [],
    });
    throw error;
  }

  await record({
    status: response.status,
    result: response.answer.ringkas,
    citations: response.citations,
    actions: response.actions,
  });
  return response;
}

// Admins read this in the Chat Log, so a validation failure is listed issue by
// issue instead of as the ZodError's raw JSON.
function describeError(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  return error instanceof Error ? error.message : String(error);
}

// A failed log write must not cost the user their answer.
async function writeChatLog(chatLog: ChatLogRepository, record: NewChatLogRecord) {
  try {
    await chatLog.insert(record);
  } catch (error) {
    console.error("Writing the Chat Log failed", error);
  }
}

export function listChatLog({ chatLog }: Pick<ChatDeps, "chatLog">, workspaceId: string) {
  return chatLog.listNewest(CHAT_LOG_LIMIT, workspaceId);
}
