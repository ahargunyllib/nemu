CREATE TABLE `integration_secret` (
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`iv` text NOT NULL,
	`ciphertext` text NOT NULL,
	`last_four` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `integration_secret_pk` PRIMARY KEY(`workspace_id`, `name`),
	CONSTRAINT `fk_integration_secret_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_integration_secret_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
