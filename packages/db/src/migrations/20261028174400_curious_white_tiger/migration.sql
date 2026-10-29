CREATE TABLE `workspace` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `telco_approval_rule` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`minimum_amount` integer NOT NULL,
	`approvers` text NOT NULL,
	CONSTRAINT `fk_telco_approval_rule_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_claim` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`fixture` text NOT NULL,
	`customer` text NOT NULL,
	`letter_number` text NOT NULL,
	`service_id` text NOT NULL,
	`period` text NOT NULL,
	`letter_date` text NOT NULL,
	`received_at` text NOT NULL,
	`claimed_minutes` integer NOT NULL,
	`invoice_id` text NOT NULL,
	`notes` text NOT NULL,
	CONSTRAINT `fk_telco_claim_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_invoice` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`service_id` text NOT NULL,
	`period` text NOT NULL,
	`monthly_fee_idr` integer NOT NULL,
	`other_tax_base_idr` integer NOT NULL,
	`vat_idr` integer NOT NULL,
	`total_idr` integer NOT NULL,
	`issued_on` text NOT NULL,
	`status` text NOT NULL,
	CONSTRAINT `fk_telco_invoice_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_rca` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`ticket_ids` text NOT NULL,
	`cause` text NOT NULL,
	`status` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_on` text NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `fk_telco_rca_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_service` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`customer` text NOT NULL,
	`location` text NOT NULL,
	`product` text NOT NULL,
	`bandwidth_mbps` integer NOT NULL,
	`monthly_fee_idr` integer NOT NULL,
	`contract_id` text NOT NULL,
	`addendum_id` text,
	`base_sla_basis_points` integer NOT NULL,
	`effective_sla_basis_points` integer NOT NULL,
	`active_since` text NOT NULL,
	CONSTRAINT `fk_telco_service_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_task` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`name` text NOT NULL,
	`assignee_id` text NOT NULL,
	`created_at` text NOT NULL,
	`review_due_on` text,
	`status` text NOT NULL,
	CONSTRAINT `fk_telco_task_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_ticket` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`service_id` text NOT NULL,
	`started_at` text NOT NULL,
	`recovered_at` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`cause` text NOT NULL,
	`rca_id` text,
	`rca_status` text NOT NULL,
	`reporter` text NOT NULL,
	`summary` text NOT NULL,
	CONSTRAINT `fk_telco_ticket_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `telco_user` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`joined_on` text NOT NULL,
	`email` text NOT NULL,
	CONSTRAINT `fk_telco_user_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `workspace_id` text DEFAULT 'W-TRAVEL' NOT NULL;--> statement-breakpoint
CREATE INDEX `knowledge_document_workspaceId_idx` ON `knowledge_document` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telco_approval_rule_workspaceId_idx` ON `telco_approval_rule` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telco_claim_workspaceId_idx` ON `telco_claim` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telco_invoice_workspaceId_idx` ON `telco_invoice` (`workspace_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `telco_rca_workspaceId_idx` ON `telco_rca` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telco_service_workspaceId_idx` ON `telco_service` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telco_task_workspaceId_idx` ON `telco_task` (`workspace_id`,`claim_id`);--> statement-breakpoint
CREATE INDEX `telco_ticket_workspaceId_idx` ON `telco_ticket` (`workspace_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `telco_user_workspaceId_idx` ON `telco_user` (`workspace_id`);