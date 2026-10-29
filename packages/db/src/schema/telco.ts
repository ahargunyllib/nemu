import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { workspace } from "./workspace";

const workspaceId = () =>
  text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" });

export const telcoClaim = sqliteTable(
  "telco_claim",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    fixture: text("fixture").notNull(),
    customer: text("customer").notNull(),
    letterNumber: text("letter_number").notNull(),
    serviceId: text("service_id").notNull(),
    period: text("period").notNull(),
    letterDate: text("letter_date").notNull(),
    receivedAt: text("received_at").notNull(),
    claimedMinutes: integer("claimed_minutes").notNull(),
    invoiceId: text("invoice_id").notNull(),
    notes: text("notes").notNull(),
  },
  (table) => [index("telco_claim_workspaceId_idx").on(table.workspaceId)],
);

export const telcoService = sqliteTable(
  "telco_service",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    customer: text("customer").notNull(),
    location: text("location").notNull(),
    product: text("product").notNull(),
    bandwidthMbps: integer("bandwidth_mbps").notNull(),
    monthlyFeeIdr: integer("monthly_fee_idr").notNull(),
    contractId: text("contract_id").notNull(),
    addendumId: text("addendum_id"),
    baseSlaBasisPoints: integer("base_sla_basis_points").notNull(),
    effectiveSlaBasisPoints: integer("effective_sla_basis_points").notNull(),
    activeSince: text("active_since").notNull(),
  },
  (table) => [index("telco_service_workspaceId_idx").on(table.workspaceId)],
);

export const telcoInvoice = sqliteTable(
  "telco_invoice",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    serviceId: text("service_id").notNull(),
    period: text("period").notNull(),
    monthlyFeeIdr: integer("monthly_fee_idr").notNull(),
    otherTaxBaseIdr: integer("other_tax_base_idr").notNull(),
    vatIdr: integer("vat_idr").notNull(),
    totalIdr: integer("total_idr").notNull(),
    issuedOn: text("issued_on").notNull(),
    status: text("status").notNull(),
  },
  (table) => [index("telco_invoice_workspaceId_idx").on(table.workspaceId, table.serviceId)],
);

export const telcoTicket = sqliteTable(
  "telco_ticket",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    serviceId: text("service_id").notNull(),
    startedAt: text("started_at").notNull(),
    recoveredAt: text("recovered_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    cause: text("cause").notNull(),
    rcaId: text("rca_id"),
    rcaStatus: text("rca_status").notNull(),
    reporter: text("reporter").notNull(),
    summary: text("summary").notNull(),
  },
  (table) => [index("telco_ticket_workspaceId_idx").on(table.workspaceId, table.serviceId)],
);

export const telcoRca = sqliteTable(
  "telco_rca",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    ticketIds: text("ticket_ids", { mode: "json" }).$type<string[]>().notNull(),
    cause: text("cause").notNull(),
    status: text("status").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedOn: text("approved_on").notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("telco_rca_workspaceId_idx").on(table.workspaceId)],
);

export const telcoUser = sqliteTable(
  "telco_user",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    joinedOn: text("joined_on").notNull(),
    email: text("email").notNull(),
  },
  (table) => [index("telco_user_workspaceId_idx").on(table.workspaceId)],
);

export const telcoTask = sqliteTable(
  "telco_task",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    claimId: text("claim_id").notNull(),
    name: text("name").notNull(),
    assigneeId: text("assignee_id").notNull(),
    createdAt: text("created_at").notNull(),
    reviewDueOn: text("review_due_on"),
    status: text("status").notNull(),
    /** The telco users who have approved the claim at Persetujuan, in route order. */
    approvedBy: text("approved_by", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (table) => [index("telco_task_workspaceId_idx").on(table.workspaceId, table.claimId)],
);

export const telcoApprovalRule = sqliteTable(
  "telco_approval_rule",
  {
    id: text("id").primaryKey(),
    workspaceId: workspaceId(),
    minimumAmount: integer("minimum_amount").notNull(),
    approvers: text("approvers", { mode: "json" }).$type<string[]>().notNull(),
  },
  (table) => [index("telco_approval_rule_workspaceId_idx").on(table.workspaceId)],
);
