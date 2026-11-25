-- School workspace (W-SEKOLAH) for Nemu v2.2: fictional SDIT Nusantara, synthetic data only.
-- Passwords are documented in docs/school-ai.md. Hashes come from better-auth hashPassword.
-- The SOP and kamus are synthetic stand-ins; replace them with the data-uji-mvp-v2 files in the Admin Workspace.
--> statement-breakpoint
INSERT INTO `workspace` (`id`, `name`, `domain`, `demo_date`) VALUES
  ('W-SEKOLAH', 'Administrasi Sekolah (SDIT Nusantara)', 'school', '2026-12-01');
--> statement-breakpoint
INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `role`, `workspace_id`) VALUES
  ('siti', 'Siti Rahmawati', 'siti@nemu.demo', 1, 'guru', 'W-SEKOLAH'),
  ('rizal', 'Rizal Hidayat', 'rizal@nemu.demo', 1, 'admin', 'W-SEKOLAH');
--> statement-breakpoint
INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `updated_at`) VALUES
  ('siti-credential', 'siti', 'credential', 'siti', '013332e544d51efd9ac8d8be8b30cd23:c17d1c6c418d9beac44e548e5b185fe972bb92f9c451fa7e6506b518befd8e1ac1ae2da2c7c33c28a278c5b6b8d31d64a48a20a516ab71ffa87e57236995294d', cast(unixepoch('subsecond') * 1000 as integer)),
  ('rizal-credential', 'rizal', 'credential', 'rizal', '72fa0c0784870639f1f5447334175ab5:84d9b379fb821132ed09a81f79b56f4ca5f3def5fb43af4df408278c09cc8e3fe2ce170825080409ef352f019ab508622da23520e8fc2114aa172c8063b8a6cc', cast(unixepoch('subsecond') * 1000 as integer));
--> statement-breakpoint
INSERT INTO `knowledge_document` (`id`, `workspace_id`, `title`, `version`, `is_active`, `status`, `failure_reason`, `format`, `file_name`, `content_type`, `size_bytes`, `storage_key`) VALUES
  ('sop-penilaian-sdit-nusantara', 'W-SEKOLAH', 'SOP Penilaian SDIT Nusantara', '2026', 1, 'ready', NULL, 'md', 'SOP-Penilaian-SDIT-Nusantara.md', 'text/markdown', 456, 'seed/sekolah/SOP-Penilaian-SDIT-Nusantara.md'),
  ('kamus-kendala-sdit-nusantara', 'W-SEKOLAH', 'Kamus Kendala', '2026', 1, 'ready', NULL, 'md', 'Kamus-Kendala-SDIT-Nusantara.md', 'text/markdown', 415, 'seed/sekolah/Kamus-Kendala-SDIT-Nusantara.md');
--> statement-breakpoint
INSERT INTO `knowledge_chunk` (`id`, `document_id`, `article`, `section`, `page`, `sequence`, `text`) VALUES
  ('sop-p2-3-2', 'sop-penilaian-sdit-nusantara', '3.2', NULL, 2, 0, '3.2 Kriteria Ketuntasan Minimal (KKM) untuk seluruh mata pelajaran adalah 75. Peserta didik dengan nilai di bawah 75 wajib mengikuti remedial.'),
  ('sop-p2-3-3', 'sop-penilaian-sdit-nusantara', '3.3', NULL, 2, 1, '3.3 Remedial dilaksanakan paling banyak 2 kali. Nilai hasil remedial paling tinggi 75.'),
  ('sop-p3-4-1', 'sop-penilaian-sdit-nusantara', '4.1', NULL, 3, 2, '4.1 Nilai UTS diinput ke AlurSekolah paling lambat 7 hari kerja setelah pelaksanaan UTS.'),
  ('sop-p3-4-3', 'sop-penilaian-sdit-nusantara', '4.3', NULL, 3, 3, '4.3 Peserta didik yang tidak hadir karena sakit, izin, atau alpa nilainya dikosongkan, bukan diberi nilai 0, sampai mengikuti ujian susulan.'),
  ('kamus-k01', 'kamus-kendala-sdit-nusantara', 'K-01', NULL, 1, 0, 'K-01 Ruang GTK: "SKP belum bisa diajukan karena RHK atasan belum tersedia". Bukan kesalahan guru. Kepala sekolah perlu membuat RHK terlebih dahulu di E-Kinerja.'),
  ('kamus-k02', 'kamus-kendala-sdit-nusantara', 'K-02', NULL, 1, 1, 'K-02 AlurSekolah: "Sesi Anda telah berakhir". Guru cukup masuk kembali dengan menekan tombol Masuk.'),
  ('kamus-k03', 'kamus-kendala-sdit-nusantara', 'K-03', NULL, 2, 2, 'K-03 AlurSekolah: "Mata pelajaran belum dipetakan ke kelas". Bukan kesalahan guru. Operator sekolah perlu memetakan mata pelajaran di menu Pengaturan Kelas.');
