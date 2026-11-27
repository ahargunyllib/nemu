-- F2 "ini kenapa?" (#205): synthetic Kamus Kendala rows for the F2-2 and F2-3 test cases, numbered
-- as the test pack cites them (no. 2 and no. 7). The official 03_F2_macet pack isn't in the repo,
-- so these stand in for it; import the school's own kamus in WS-05 to replace them.
-- K-02 becomes the Ruang GTK sync error (F2-3); the old K-02 (session expired) moves to K-04.
-- Only the untouched seeded row is changed, never one the operator edited.
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'Ruang GTK',
  `message` = 'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja',
  `meaning` = 'Akun Anda belum ditandai sebagai User Ruang GTK, jadi SKP belum bisa dikirim ke E-Kinerja',
  `teacher_fault` = 0,
  `fixer` = 'guru',
  `fix` = 'Guru cukup membuka menu E-Kinerja dan menekan tombol Sinkro Ruang GTK, lalu mengirim ulang SKP.'
WHERE `id` = 'k02' AND `workspace_id` = 'W-SEKOLAH' AND `message` = 'Sesi Anda telah berakhir';
--> statement-breakpoint
INSERT OR IGNORE INTO `kamus_kendala` (`id`, `workspace_id`, `code`, `app`, `message`, `meaning`, `teacher_fault`, `fixer`, `fix`) VALUES
  ('k04', 'W-SEKOLAH', 'K-04', 'AlurSekolah', 'Sesi Anda telah berakhir', '', 1, 'guru', 'Guru cukup masuk kembali dengan menekan tombol Masuk.'),
  ('k05', 'W-SEKOLAH', 'K-05', 'AlurSekolah', 'Nilai harus berupa angka 0 sampai 100', 'Isian nilai berisi huruf atau angka di luar 0 sampai 100', 1, 'guru', 'Guru cukup mengganti isian itu dengan angka 0 sampai 100, lalu menyimpan lagi.'),
  ('k06', 'W-SEKOLAH', 'K-06', 'Ruang GTK', 'NUPTK Anda belum terverifikasi', 'Data PTK Anda di Dapodik belum cocok dengan data Ruang GTK', 0, 'operator', 'Operator sekolah perlu memperbarui data PTK di Dapodik, lalu menunggu sinkronisasi.'),
  ('k07', 'W-SEKOLAH', 'K-07', 'AlurSekolah', 'Anda belum ditugaskan mengampu [mapel] di kelas [kelas]', 'Mata pelajaran itu belum ditugaskan ke akun Anda di kelas tersebut, jadi daftar siswanya tidak bisa dibuka', 0, 'operator', 'Operator sekolah perlu menugaskan mata pelajaran itu ke guru di menu Penugasan Guru.');
