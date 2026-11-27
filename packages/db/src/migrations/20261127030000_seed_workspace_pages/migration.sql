-- Workspace pages (#212): the built-in AlurSekolah package (WS-02), the WS-08 defaults for
-- SDIT Nusantara, and the Kamus Kendala moved from a knowledge document into its WS-05 table.
-- The kamus rows keep the seeded entries word for word; Nemu now reads "ini kenapa?" from them.
--> statement-breakpoint
INSERT INTO `knowledge_package` (`id`, `title`, `all_schools`) VALUES
  ('alursekolah', 'Paket AlurSekolah bawaan', 1);
--> statement-breakpoint
INSERT INTO `school_setting` (`workspace_id`) VALUES ('W-SEKOLAH');
--> statement-breakpoint
INSERT INTO `kamus_kendala` (`id`, `workspace_id`, `code`, `app`, `message`, `meaning`, `teacher_fault`, `fixer`, `fix`) VALUES
  ('k01', 'W-SEKOLAH', 'K-01', 'Ruang GTK', 'SKP belum bisa diajukan karena RHK atasan belum tersedia', '', 0, 'kepsek', 'Kepala sekolah perlu membuat RHK terlebih dahulu di E-Kinerja.'),
  ('k02', 'W-SEKOLAH', 'K-02', 'AlurSekolah', 'Sesi Anda telah berakhir', '', 1, 'guru', 'Guru cukup masuk kembali dengan menekan tombol Masuk.'),
  ('k03', 'W-SEKOLAH', 'K-03', 'AlurSekolah', 'Mata pelajaran belum dipetakan ke kelas', '', 0, 'operator', 'Operator sekolah perlu memetakan mata pelajaran di menu Pengaturan Kelas.');
--> statement-breakpoint
DELETE FROM `knowledge_document` WHERE `id` = 'kamus-kendala-sdit-nusantara';
