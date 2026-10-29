-- Correct the seeded outbound boarding pass after the demo route changed to Yogyakarta–Makassar.
UPDATE `process_document`
SET `nama_file` = 'boarding-pass-pergi-yia-upg.pdf'
WHERE `instance_id` = 'PD-2026-0042'
	AND `jenis` = 'boarding_pass_pergi'
	AND `nama_file` = 'boarding-pass-pergi-cgk-upg.pdf';
