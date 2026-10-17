CREATE TABLE `process_document` (
	`instance_id` text NOT NULL,
	`jenis` text NOT NULL,
	`nama_file` text NOT NULL,
	`uploaded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `process_document_pk` PRIMARY KEY(`instance_id`, `jenis`),
	CONSTRAINT `fk_process_document_instance_id_process_instance_id_fk` FOREIGN KEY (`instance_id`) REFERENCES `process_instance`(`id`) ON DELETE CASCADE
);
