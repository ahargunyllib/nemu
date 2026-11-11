CREATE TABLE `rule_source` (
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`document_id` text NOT NULL,
	`article` text,
	`page` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `rule_source_pk` PRIMARY KEY(`workspace_id`, `key`),
	CONSTRAINT `fk_rule_source_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE CASCADE
);
