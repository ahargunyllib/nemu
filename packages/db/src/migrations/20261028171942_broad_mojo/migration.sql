ALTER TABLE `user` ADD `unit` text;--> statement-breakpoint
ALTER TABLE `user` ADD `province` text;--> statement-breakpoint
UPDATE `user`
SET `unit` = 'Balai Layanan Digital Wilayah Yogyakarta',
    `province` = 'DI Yogyakarta'
WHERE `id` IN ('rina', 'verifikator');
