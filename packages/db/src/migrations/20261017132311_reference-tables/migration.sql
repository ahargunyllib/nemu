CREATE TABLE `reference_table` (
	`type` text PRIMARY KEY,
	`file_name` text NOT NULL,
	`columns` text NOT NULL,
	`rows` text NOT NULL,
	`row_count` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
