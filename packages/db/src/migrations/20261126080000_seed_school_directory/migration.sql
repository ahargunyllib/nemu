-- WS-06 for SDIT Nusantara (W-SEKOLAH), from the synthetic data-uji-mvp-v2.3 profil-sekolah.json and
-- daftar-siswa-*.csv. Every name, NIP, NIS and phone number is fictional. The mock AlurSekolah has
-- usernames only, so each teacher's AlurSekolah email is <username>@sditnusantara.sch.id.
-- Pak Rizal becomes the school operator; Admin Javan (javan@nemu.demo, password javan-demo-2026)
-- sees every school. Hashes come from better-auth hashPassword.
--> statement-breakpoint
UPDATE `workspace` SET `name` = 'SDIT Nusantara' WHERE `id` = 'W-SEKOLAH';
--> statement-breakpoint
UPDATE `user` SET `role` = 'operator' WHERE `id` = 'rizal';
--> statement-breakpoint
INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `role`, `workspace_id`) VALUES
  ('javan', 'Admin Javan', 'javan@nemu.demo', 1, 'admin', 'W-SEKOLAH');
--> statement-breakpoint
INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `updated_at`) VALUES
  ('javan-credential', 'javan', 'credential', 'javan', 'b0abd470c15bc103116a21eb80028cf0:67462c2c385f6b91091bb70ffb87ee64290d7b762fea6b38936509baf009f0bc386a10f6de5f1bae4c8028ecda1de909d01566ea6cca757f6acf40b477385615', cast(unixepoch('subsecond') * 1000 as integer));
--> statement-breakpoint
INSERT INTO `school_teacher` (`id`, `workspace_id`, `user_id`, `name`, `honorific`, `nip`, `email`, `phone`, `classes`, `subjects`) VALUES
  ('siti', 'W-SEKOLAH', 'siti', 'Siti Aminah, S.Pd.', 'Bu', '197003152000032001', 'siti.aminah@sditnusantara.sch.id', '6281200001001', '["4A","4B"]', '["IPAS","Bahasa Inggris","Tahfidz","Matematika","Bahasa Indonesia"]'),
  ('dewi', 'W-SEKOLAH', NULL, 'Dewi Lestari, S.Pd.', 'Bu', '', 'dewi.lestari@sditnusantara.sch.id', '6281200001004', '["5A"]', '["Bahasa Indonesia"]');
--> statement-breakpoint
INSERT INTO `school_contact` (`id`, `workspace_id`, `role`, `name`, `honorific`, `phone`) VALUES
  ('sekolah-kepsek', 'W-SEKOLAH', 'kepsek', 'Ahmad Fauzi, M.Pd.', 'Pak', '6281200001002'),
  ('sekolah-operator', 'W-SEKOLAH', 'operator', 'Rizal Pratama', 'Pak', '6281200001003'),
  ('sekolah-keuangan', 'W-SEKOLAH', 'keuangan', 'Ratna Sari', 'Bu', '6281200001005');
--> statement-breakpoint
INSERT INTO `school_student` (`id`, `workspace_id`, `class_name`, `number`, `nis`, `name`) VALUES
  ('4a-01', 'W-SEKOLAH', '4A', 1, '4101', 'Aisyah Putri Wijaya'),
  ('4a-02', 'W-SEKOLAH', '4A', 2, '4102', 'Fatih Rizky Wijaya'),
  ('4a-03', 'W-SEKOLAH', '4A', 3, '4103', 'Zahra Nur Wijaya'),
  ('4a-04', 'W-SEKOLAH', '4A', 4, '4104', 'Bagas Pratama'),
  ('4a-05', 'W-SEKOLAH', '4A', 5, '4105', 'Citra Lestari'),
  ('4a-06', 'W-SEKOLAH', '4A', 6, '4106', 'Dimas Saputra'),
  ('4a-07', 'W-SEKOLAH', '4A', 7, '4107', 'Elsa Maharani'),
  ('4a-08', 'W-SEKOLAH', '4A', 8, '4108', 'Gilang Ramadhan'),
  ('4a-09', 'W-SEKOLAH', '4A', 9, '4109', 'Hana Safitri'),
  ('4a-10', 'W-SEKOLAH', '4A', 10, '4110', 'Ilham Nugroho'),
  ('4b-01', 'W-SEKOLAH', '4B', 1, '0159870001', 'Ahmad Fadli'),
  ('4b-02', 'W-SEKOLAH', '4B', 2, '0159870002', 'Aisyah Zahra'),
  ('4b-03', 'W-SEKOLAH', '4B', 3, '0159870003', 'Alya Nur Fitri'),
  ('4b-04', 'W-SEKOLAH', '4B', 4, '0159870004', 'Bagas Saputra'),
  ('4b-05', 'W-SEKOLAH', '4B', 5, '0159870005', 'Budi Santoso'),
  ('4b-06', 'W-SEKOLAH', '4B', 6, '0159870006', 'Citra Ayu Lestari'),
  ('4b-07', 'W-SEKOLAH', '4B', 7, '0159870007', 'Dimas Pratama'),
  ('4b-08', 'W-SEKOLAH', '4B', 8, '0159870008', 'Dinda Maharani'),
  ('4b-09', 'W-SEKOLAH', '4B', 9, '0159870009', 'Fahri Hidayat'),
  ('4b-10', 'W-SEKOLAH', '4B', 10, '0159870010', 'Farah Annisa'),
  ('4b-11', 'W-SEKOLAH', '4B', 11, '0159870011', 'Galih Ramadhan'),
  ('4b-12', 'W-SEKOLAH', '4B', 12, '0159870012', 'Hana Salsabila'),
  ('4b-13', 'W-SEKOLAH', '4B', 13, '0159870013', 'Ilham Maulana'),
  ('4b-14', 'W-SEKOLAH', '4B', 14, '0159870014', 'Intan Permata'),
  ('4b-15', 'W-SEKOLAH', '4B', 15, '0159870015', 'Kevin Ardiansyah'),
  ('4b-16', 'W-SEKOLAH', '4B', 16, '0159870016', 'Laila Nur Azizah'),
  ('4b-17', 'W-SEKOLAH', '4B', 17, '0159870017', 'Muhammad Rizky'),
  ('4b-18', 'W-SEKOLAH', '4B', 18, '0159870018', 'Nabila Putri Ramadhani'),
  ('4b-19', 'W-SEKOLAH', '4B', 19, '0159870019', 'Naufal Akbar'),
  ('4b-20', 'W-SEKOLAH', '4B', 20, '0159870020', 'Nur Aini'),
  ('4b-21', 'W-SEKOLAH', '4B', 21, '0159870021', 'Putra Wijaya'),
  ('4b-22', 'W-SEKOLAH', '4B', 22, '0159870022', 'Qonita Rahma'),
  ('4b-23', 'W-SEKOLAH', '4B', 23, '0159870023', 'Raka Aditya'),
  ('4b-24', 'W-SEKOLAH', '4B', 24, '0159870024', 'Rani Oktaviani'),
  ('4b-25', 'W-SEKOLAH', '4B', 25, '0159870025', 'Salsabila Putri'),
  ('4b-26', 'W-SEKOLAH', '4B', 26, '0159870026', 'Siti Nur Haliza'),
  ('4b-27', 'W-SEKOLAH', '4B', 27, '0159870027', 'Taufik Hidayatullah'),
  ('4b-28', 'W-SEKOLAH', '4B', 28, '0159870028', 'Tiara Anjani'),
  ('4b-29', 'W-SEKOLAH', '4B', 29, '0159870029', 'Umar Faruq'),
  ('4b-30', 'W-SEKOLAH', '4B', 30, '0159870030', 'Vina Amelia'),
  ('4b-31', 'W-SEKOLAH', '4B', 31, '0159870031', 'Yusuf Alfarizi'),
  ('4b-32', 'W-SEKOLAH', '4B', 32, '0159870032', 'Zahra Khairunnisa'),
  ('5a-01', 'W-SEKOLAH', '5A', 1, '0148760001', 'Adit Firmansyah'),
  ('5a-02', 'W-SEKOLAH', '5A', 2, '0148760002', 'Bella Safitri'),
  ('5a-03', 'W-SEKOLAH', '5A', 3, '0148760003', 'Cahya Purnama'),
  ('5a-04', 'W-SEKOLAH', '5A', 4, '0148760004', 'Daffa Hakim'),
  ('5a-05', 'W-SEKOLAH', '5A', 5, '0148760005', 'Elsa Maharani'),
  ('5a-06', 'W-SEKOLAH', '5A', 6, '0148760006', 'Fajar Nugroho'),
  ('5a-07', 'W-SEKOLAH', '5A', 7, '0148760007', 'Gita Puspita'),
  ('5a-08', 'W-SEKOLAH', '5A', 8, '0148760008', 'Hafiz Ramadhan'),
  ('5a-09', 'W-SEKOLAH', '5A', 9, '0148760009', 'Indah Sari'),
  ('5a-10', 'W-SEKOLAH', '5A', 10, '0148760010', 'Joko Susilo'),
  ('5a-11', 'W-SEKOLAH', '5A', 11, '0148760011', 'Kirana Dewi'),
  ('5a-12', 'W-SEKOLAH', '5A', 12, '0148760012', 'Lutfi Hakim'),
  ('5a-13', 'W-SEKOLAH', '5A', 13, '0148760013', 'Mira Anggraini'),
  ('5a-14', 'W-SEKOLAH', '5A', 14, '0148760014', 'Nanda Saputra'),
  ('5a-15', 'W-SEKOLAH', '5A', 15, '0148760015', 'Oki Firmansyah'),
  ('5a-16', 'W-SEKOLAH', '5A', 16, '0148760016', 'Putri Ayu'),
  ('5a-17', 'W-SEKOLAH', '5A', 17, '0148760017', 'Rafi Akbar'),
  ('5a-18', 'W-SEKOLAH', '5A', 18, '0148760018', 'Sinta Bella'),
  ('5a-19', 'W-SEKOLAH', '5A', 19, '0148760019', 'Tegar Prasetyo'),
  ('5a-20', 'W-SEKOLAH', '5A', 20, '0148760020', 'Wulan Sari');
