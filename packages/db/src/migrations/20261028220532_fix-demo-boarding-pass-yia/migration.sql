-- Rina flies from Yogyakarta (issue #122): the seeded boarding pass pergi is the YIA–UPG sample,
-- as packages/api/src/modules/process-instances/demo-seed.ts has it.
UPDATE `process_document` SET `nama_file` = 'boarding-pass-pergi-yia-upg.pdf'
WHERE `instance_id` = 'PD-2026-0042' AND `jenis` = 'boarding_pass_pergi' AND `nama_file` = 'boarding-pass-pergi-cgk-upg.pdf';
