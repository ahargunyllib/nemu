import { and, type Database, eq, getColumns, like } from "@nemu/db";
import {
  telcoApprovalRule,
  telcoClaim,
  telcoInvoice,
  telcoService,
  telcoTask,
  telcoTicket,
  telcoUser,
} from "@nemu/db/schema/telco";

export type SlaClaimRecord = typeof telcoClaim.$inferSelect;
export type SlaServiceRecord = typeof telcoService.$inferSelect;
export type SlaInvoiceRecord = typeof telcoInvoice.$inferSelect;
export type SlaTicketRecord = typeof telcoTicket.$inferSelect;
export type SlaApprovalRuleRecord = typeof telcoApprovalRule.$inferSelect;
export type SlaTaskRecord = typeof telcoTask.$inferSelect;
export type SlaUserRecord = typeof telcoUser.$inferSelect;

export type SlaClaimRepository = {
  listClaims(workspaceId: string): Promise<SlaClaimRecord[]>;
  listTasks(workspaceId: string, assigneeId: string): Promise<SlaTaskRecord[]>;
  listWorkspaceTasks(workspaceId: string): Promise<SlaTaskRecord[]>;
  findAssignedTaskByService(
    workspaceId: string,
    assigneeId: string,
    serviceId: string,
  ): Promise<SlaTaskRecord | undefined>;
  findAssignedTaskByInvoice(
    workspaceId: string,
    assigneeId: string,
    invoiceId: string,
  ): Promise<SlaTaskRecord | undefined>;
  findClaim(workspaceId: string, claimId: string): Promise<SlaClaimRecord | undefined>;
  findService(workspaceId: string, serviceId: string): Promise<SlaServiceRecord | undefined>;
  findInvoice(workspaceId: string, invoiceId: string): Promise<SlaInvoiceRecord | undefined>;
  listTickets(workspaceId: string, serviceId: string, period: string): Promise<SlaTicketRecord[]>;
  listApprovalRules(workspaceId: string): Promise<SlaApprovalRuleRecord[]>;
  findTask(workspaceId: string, claimId: string): Promise<SlaTaskRecord | undefined>;
  findUser(workspaceId: string, userId: string): Promise<SlaUserRecord | undefined>;
  updateTask(
    workspaceId: string,
    taskId: string,
    update: Pick<SlaTaskRecord, "name" | "status"> & Partial<Pick<SlaTaskRecord, "approvedBy">>,
  ): Promise<SlaTaskRecord | undefined>;
  replaceTasks(workspaceId: string, tasks: readonly SlaTaskRecord[]): Promise<void>;
};

export function createSlaClaimRepository(db: Database): SlaClaimRepository {
  return {
    listClaims(workspaceId) {
      return db
        .select()
        .from(telcoClaim)
        .where(eq(telcoClaim.workspaceId, workspaceId))
        .orderBy(telcoClaim.id);
    },
    listTasks(workspaceId, assigneeId) {
      return db
        .select()
        .from(telcoTask)
        .where(and(eq(telcoTask.workspaceId, workspaceId), eq(telcoTask.assigneeId, assigneeId)))
        .orderBy(telcoTask.createdAt, telcoTask.id);
    },
    listWorkspaceTasks(workspaceId) {
      return db
        .select()
        .from(telcoTask)
        .where(eq(telcoTask.workspaceId, workspaceId))
        .orderBy(telcoTask.createdAt, telcoTask.id);
    },
    async findAssignedTaskByService(workspaceId, assigneeId, serviceId) {
      const records = await db
        .select({ ...getColumns(telcoTask) })
        .from(telcoTask)
        .innerJoin(
          telcoClaim,
          and(
            eq(telcoClaim.workspaceId, telcoTask.workspaceId),
            eq(telcoClaim.id, telcoTask.claimId),
          ),
        )
        .where(
          and(
            eq(telcoTask.workspaceId, workspaceId),
            eq(telcoTask.assigneeId, assigneeId),
            eq(telcoClaim.serviceId, serviceId),
          ),
        )
        .orderBy(telcoTask.createdAt)
        .limit(2);
      if (records.length > 1) {
        throw new Error(`Service ${serviceId} belongs to more than one assigned claim`);
      }
      return records[0];
    },
    async findAssignedTaskByInvoice(workspaceId, assigneeId, invoiceId) {
      const records = await db
        .select({ ...getColumns(telcoTask) })
        .from(telcoTask)
        .innerJoin(
          telcoClaim,
          and(
            eq(telcoClaim.workspaceId, telcoTask.workspaceId),
            eq(telcoClaim.id, telcoTask.claimId),
          ),
        )
        .where(
          and(
            eq(telcoTask.workspaceId, workspaceId),
            eq(telcoTask.assigneeId, assigneeId),
            eq(telcoClaim.invoiceId, invoiceId),
          ),
        )
        .orderBy(telcoTask.createdAt)
        .limit(2);
      if (records.length > 1) {
        throw new Error(`Invoice ${invoiceId} belongs to more than one assigned claim`);
      }
      return records[0];
    },
    async findClaim(workspaceId, claimId) {
      const [record] = await db
        .select()
        .from(telcoClaim)
        .where(and(eq(telcoClaim.workspaceId, workspaceId), eq(telcoClaim.id, claimId)))
        .limit(1);
      return record;
    },
    async findService(workspaceId, serviceId) {
      const [record] = await db
        .select()
        .from(telcoService)
        .where(and(eq(telcoService.workspaceId, workspaceId), eq(telcoService.id, serviceId)))
        .limit(1);
      return record;
    },
    async findInvoice(workspaceId, invoiceId) {
      const [record] = await db
        .select()
        .from(telcoInvoice)
        .where(and(eq(telcoInvoice.workspaceId, workspaceId), eq(telcoInvoice.id, invoiceId)))
        .limit(1);
      return record;
    },
    listTickets(workspaceId, serviceId, period) {
      return db
        .select()
        .from(telcoTicket)
        .where(
          and(
            eq(telcoTicket.workspaceId, workspaceId),
            eq(telcoTicket.serviceId, serviceId),
            like(telcoTicket.startedAt, `${period}%`),
          ),
        )
        .orderBy(telcoTicket.startedAt, telcoTicket.id);
    },
    listApprovalRules(workspaceId) {
      return db
        .select()
        .from(telcoApprovalRule)
        .where(eq(telcoApprovalRule.workspaceId, workspaceId))
        .orderBy(telcoApprovalRule.minimumAmount);
    },
    async findTask(workspaceId, claimId) {
      const [record] = await db
        .select()
        .from(telcoTask)
        .where(and(eq(telcoTask.workspaceId, workspaceId), eq(telcoTask.claimId, claimId)))
        .orderBy(telcoTask.createdAt)
        .limit(1);
      return record;
    },
    async findUser(workspaceId, userId) {
      const [record] = await db
        .select()
        .from(telcoUser)
        .where(and(eq(telcoUser.workspaceId, workspaceId), eq(telcoUser.id, userId)))
        .limit(1);
      return record;
    },
    async updateTask(workspaceId, taskId, update) {
      const [record] = await db
        .update(telcoTask)
        .set(update)
        .where(and(eq(telcoTask.workspaceId, workspaceId), eq(telcoTask.id, taskId)))
        .returning();
      return record;
    },
    async replaceTasks(workspaceId, tasks) {
      await db.delete(telcoTask).where(eq(telcoTask.workspaceId, workspaceId));
      if (tasks.length) await db.insert(telcoTask).values([...tasks]);
    },
  };
}
