CREATE TABLE `chat_log` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`url` text NOT NULL,
	`prompt` text NOT NULL,
	`has_area_crop` integer NOT NULL,
	`status` text NOT NULL,
	`result` text NOT NULL,
	`citations` text NOT NULL,
	`actions` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_chat_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `chat_log_createdAt_idx` ON `chat_log` (`created_at`);