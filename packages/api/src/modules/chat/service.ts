import {
  type NemuRequest,
  type NemuResponse,
  type ProcessContext,
  nemuResponseSchema,
} from "@nemu/contracts";
import { z } from "zod";

import type { NemuService } from "../../context";
import { WORKSPACES } from "../../workspace-ids";
import type { ChatLogRepository, NewChatLogRecord } from "./repository";

export type ChatDeps = {
  nemu: NemuService;
  chatLog: ChatLogRepository;
};

export const CHAT_LOG_LIMIT = 200;

type ChatActor = { id: string; workspaceId: string };

/** The part of a Klaim SLA Task that chat reads to build the process context. */
export type ChatSlaTask = { claimId: string; assigneeId: string; name: string; status: string };

/** Where chat reads the signed-in user's process: Perjalanan Dinas or their Klaim SLA Tasks. */
export type ChatProcessContextDeps = {
  loadTravel(actorId: string, pageUrl: string): Promise<ProcessContext | undefined>;
  listSlaTasks(workspaceId: string, actorId: string): Promise<ChatSlaTask[]>;
  findSlaTaskByService(
    workspaceId: string,
    actorId: string,
    serviceId: string,
  ): Promise<ChatSlaTask | undefined>;
  findSlaTaskByInvoice(
    workspaceId: string,
    actorId: string,
    invoiceId: string,
  ): Promise<ChatSlaTask | undefined>;
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
  if (actor.workspaceId !== WORKSPACES.telco) return deps.loadTravel(actor.id, pageUrl);

  const tasks = await deps.listSlaTasks(actor.workspaceId, actor.id);
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

// The process context comes from the Demo App's data, never from the extension.
export async function answerNemuChat(
  deps: ChatDeps & { processContexts: ChatProcessContextDeps },
  request: NemuRequest,
  actor: ChatActor,
): Promise<NemuResponse> {
  const processContext = await resolveChatProcessContext(deps.processContexts, actor, request.url);
  return answerChat(deps, { ...request, process_context: processContext }, actor.id);
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
