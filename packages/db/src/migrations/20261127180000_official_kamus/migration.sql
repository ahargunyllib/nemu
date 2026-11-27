-- F2 "ini kenapa?" (#216): the official test pack's Kamus Kendala SDIT Nusantara
-- (04_F3_workspace/kamus-kendala-sdit-nusantara.json, v1.1, synthetic) replaces the synthetic
-- seeded rows. Its no. N is K-0N, so F2-2 cites K-07 and F2-3 cites K-02. No. 6 is empty on purpose
-- (the old PK-409 message tests "belum ada di panduan sekolah"), so the synthetic K-06 goes.
-- Each row changes only while it still holds the seeded text, never one the operator edited.
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'Ruang GTK',
  `message` = 'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ada RHK atasan yang bisa dikaitkan.',
  `meaning` = 'Rencana kerja (RHK) kepala sekolah belum lengkap atau belum disepakati, jadi rencana kerja Ibu/Bapak belum bisa dikaitkan ke atasan.',
  `teacher_fault` = 0,
  `fixer` = 'kepsek',
  `fix` = 'Kepala sekolah menyelesaikan dan menyepakati perencanaan SKP-nya. Setelah itu guru menekan kirim ulang. Kalau data atasan di sistem salah, kepala sekolah menghubungi admin kepegawaian.'
WHERE `id` = 'k01' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'SKP belum bisa diajukan karena RHK atasan belum tersedia'
  AND `fix` = 'Kepala sekolah perlu membuat RHK terlebih dahulu di E-Kinerja.';
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'Ruang GTK',
  `message` = 'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ditandai sebagai User Ruang GTK.',
  `meaning` = 'Akun E-Kinerja Ibu/Bapak belum ditandai sebagai pengguna Ruang GTK.',
  `teacher_fault` = 0,
  `fixer` = 'guru',
  `fix` = 'Buka E-Kinerja, tekan tombol "Sinkro Ruang GTK", lalu ikuti petunjuknya. Setelah itu coba kirim ulang dari Ruang GTK.'
WHERE `id` = 'k02' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja'
  AND `fix` = 'Guru cukup membuka menu E-Kinerja dan menekan tombol Sinkro Ruang GTK, lalu mengirim ulang SKP.';
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'Info GTK',
  `message` = 'Pengguna tidak ditemukan.',
  `meaning` = 'Akun Ibu/Bapak belum dikenali Info GTK. Biasanya email atau data PTK di Dapodik belum sesuai atau belum tersinkron.',
  `teacher_fault` = 0,
  `fixer` = 'operator',
  `fix` = 'Operator memeriksa email dan data PTK guru di Dapodik, memperbaikinya, lalu melakukan sinkronisasi. Guru mencoba masuk lagi setelah sinkron.'
WHERE `id` = 'k03' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'Mata pelajaran belum dipetakan ke kelas'
  AND `fix` = 'Operator sekolah perlu memetakan mata pelajaran di menu Pengaturan Kelas.';
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'Info GTK',
  `message` = 'Beban Mengajar: Tidak Valid (JJM kurang dari 24 jam).',
  `meaning` = 'Jam mengajar yang tercatat kurang dari 24 jam per minggu, jadi syarat tunjangan belum terpenuhi.',
  `teacher_fault` = 0,
  `fixer` = 'operator',
  `fix` = 'Operator memeriksa rombel dan pembelajaran guru di Dapodik, memperbaiki jam yang belum tercatat, lalu sinkronisasi. Perubahan di Info GTK bisa butuh 1-7 hari.'
WHERE `id` = 'k04' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'Sesi Anda telah berakhir'
  AND `fix` = 'Guru cukup masuk kembali dengan menekan tombol Masuk.';
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'e-Rapor SD',
  `message` = 'Deskripsi capaian kosong. Tujuan pembelajaran belum dipilih.',
  `meaning` = 'Deskripsi rapor dibuat dari tujuan pembelajaran. Karena belum dipilih, deskripsinya kosong.',
  `teacher_fault` = 0,
  `fixer` = 'guru',
  `fix` = 'Buka menu tujuan pembelajaran untuk mapel tersebut, centang tujuan pembelajaran yang dinilai, simpan, lalu cetak ulang.'
WHERE `id` = 'k05' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'Nilai harus berupa angka 0 sampai 100'
  AND `fix` = 'Guru cukup mengganti isian itu dengan angka 0 sampai 100, lalu menyimpan lagi.';
--> statement-breakpoint
DELETE FROM `kamus_kendala`
WHERE `id` = 'k06' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'NUPTK Anda belum terverifikasi'
  AND `fix` = 'Operator sekolah perlu memperbarui data PTK di Dapodik, lalu menunggu sinkronisasi.';
--> statement-breakpoint
UPDATE `kamus_kendala` SET
  `app` = 'AlurSekolah',
  `message` = 'Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.',
  `meaning` = 'Bukan kesalahan Ibu/Bapak. Penugasan guru per mapel dan kelas diatur admin sekolah, dan mapel ini belum dipasangkan ke akun Ibu/Bapak untuk kelas tersebut.',
  `teacher_fault` = 0,
  `fixer` = 'operator',
  `fix` = 'Operator menambahkan penugasan guru untuk mapel dan kelas itu di pengaturan AlurSekolah. Setelah itu guru memuat ulang halaman Isi nilai kelas.'
WHERE `id` = 'k07' AND `workspace_id` = 'W-SEKOLAH'
  AND `message` = 'Anda belum ditugaskan mengampu [mapel] di kelas [kelas]'
  AND `fix` = 'Operator sekolah perlu menugaskan mata pelajaran itu ke guru di menu Penugasan Guru.';
