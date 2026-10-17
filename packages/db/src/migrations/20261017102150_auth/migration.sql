ALTER TABLE `user` ADD `golongan` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'pegawai' NOT NULL;
