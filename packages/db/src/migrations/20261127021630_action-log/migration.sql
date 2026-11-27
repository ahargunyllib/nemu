CREATE TABLE `action_log` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`teacher_id` text,
	`teacher_name` text NOT NULL,
	`acted_at` integer NOT NULL,
	`website` text NOT NULL,
	`task` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`cara` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_action_log_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_action_log_teacher_id_school_teacher_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `school_teacher`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `action_log_workspace_acted_idx` ON `action_log` (`workspace_id`,`acted_at`);