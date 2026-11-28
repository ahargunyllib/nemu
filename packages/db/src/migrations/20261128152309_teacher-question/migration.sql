CREATE TABLE `teacher_question` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`teacher_id` text,
	`asked_at` integer NOT NULL,
	`kind` text NOT NULL,
	`answered` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_teacher_question_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_teacher_question_teacher_id_school_teacher_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `school_teacher`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `teacher_question_workspace_asked_idx` ON `teacher_question` (`workspace_id`,`asked_at`);