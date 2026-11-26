CREATE TABLE `allowed_site` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`pattern` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_allowed_site_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `school_install_code` (
	`code` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_school_install_code_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allowed_site_workspace_pattern_unique` ON `allowed_site` (`workspace_id`,`pattern`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_install_code_workspace_unique` ON `school_install_code` (`workspace_id`);