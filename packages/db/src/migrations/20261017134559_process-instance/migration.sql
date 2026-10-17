CREATE TABLE `process_instance` (
	`id` text PRIMARY KEY,
	`owner_id` text NOT NULL,
	`state` text NOT NULL,
	`jenis_perjalanan` text NOT NULL,
	`nomor_surat_tugas` text NOT NULL,
	`kota_tujuan` text NOT NULL,
	`provinsi` text NOT NULL,
	`maksud` text NOT NULL,
	`tanggal_berangkat` text NOT NULL,
	`tanggal_kembali` text NOT NULL,
	`moda_transport` text NOT NULL,
	`biaya_transport` integer NOT NULL,
	`penginapan` text NOT NULL,
	`nominal_penginapan` integer NOT NULL,
	`uang_harian` integer NOT NULL,
	`dokumen_undangan` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_process_instance_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `process_instance_ownerId_idx` ON `process_instance` (`owner_id`);