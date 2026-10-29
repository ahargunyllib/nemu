CREATE TABLE `knowledge_chunk` (
	`id` text PRIMARY KEY,
	`document_id` text NOT NULL,
	`article` text,
	`section` text,
	`page` integer,
	`sequence` integer NOT NULL,
	`text` text NOT NULL,
	CONSTRAINT `fk_knowledge_chunk_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `knowledge_chunk_documentId_idx` ON `knowledge_chunk` (`document_id`,`sequence`);