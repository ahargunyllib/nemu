import type { Database } from "@nemu/db";

import { createProcessInstanceDeps, loadProcessContext } from "../process-instances/service";
import { createSlaClaimRepository } from "../sla-claims/repository";
import type { ChatProcessContextDeps } from "./service";

export function createChatProcessContextDeps(db: Database): ChatProcessContextDeps {
  const processInstances = createProcessInstanceDeps(db);
  const slaClaims = createSlaClaimRepository(db);
  return {
    loadTravel: (actorId, pageUrl) => loadProcessContext(processInstances, actorId, pageUrl),
    listSlaTasks: (workspaceId, actorId) => slaClaims.listTasks(workspaceId, actorId),
    findSlaTaskByService: (workspaceId, actorId, serviceId) =>
      slaClaims.findAssignedTaskByService(workspaceId, actorId, serviceId),
    findSlaTaskByInvoice: (workspaceId, actorId, invoiceId) =>
      slaClaims.findAssignedTaskByInvoice(workspaceId, actorId, invoiceId),
  };
}
