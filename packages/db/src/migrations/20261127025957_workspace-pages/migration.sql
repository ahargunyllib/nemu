CREATE TABLE `knowledge_package` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`all_schools` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_knowledge_package_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `process_element` (
	`document_id` text NOT NULL,
	`element_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sequence` integer NOT NULL,
	`symptoms` text DEFAULT '[]' NOT NULL,
	`page` text,
	`page_edited` integer DEFAULT false NOT NULL,
	CONSTRAINT `process_element_pk` PRIMARY KEY(`document_id`, `element_id`),
	CONSTRAINT `fk_process_element_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `school_setting` (
	`workspace_id` text PRIMARY KEY,
	`talk_shortcut` text DEFAULT 'Ctrl+Space' NOT NULL,
	`default_cara` text DEFAULT 'isi' NOT NULL,
	`fill_speed` text DEFAULT 'normal' NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_school_setting_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_school_setting_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `kamus_kendala` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`code` text NOT NULL,
	`app` text NOT NULL,
	`message` text NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`teacher_fault` integer DEFAULT false NOT NULL,
	`fixer` text NOT NULL,
	`fix` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_kamus_kendala_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `site_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `package_id` text REFERENCES knowledge_package(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `created_by` text REFERENCES user(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `changed_by` text REFERENCES user(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `allowed_site` ADD `permission` text DEFAULT 'read_fill' NOT NULL;--> statement-breakpoint
CREATE INDEX `kamus_kendala_workspace_idx` ON `kamus_kendala` (`workspace_id`,`code`);