CREATE TABLE `school_contact` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`honorific` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_school_contact_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_student` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`class_name` text NOT NULL,
	`number` integer NOT NULL,
	`nis` text NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT `fk_school_student_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_teacher` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`honorific` text NOT NULL,
	`nip` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`classes` text NOT NULL,
	`subjects` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_school_teacher_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_school_teacher_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_contact_workspace_role_unique` ON `school_contact` (`workspace_id`,`role`);--> statement-breakpoint
CREATE INDEX `school_student_class_idx` ON `school_student` (`workspace_id`,`class_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_teacher_email_unique` ON `school_teacher` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_teacher_phone_unique` ON `school_teacher` (`phone`);--> statement-breakpoint
CREATE INDEX `school_teacher_workspaceId_idx` ON `school_teacher` (`workspace_id`);