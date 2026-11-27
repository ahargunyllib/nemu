-- F3-2: the official SOP Penilaian (test pack 04_F3_workspace/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf,
-- synthetic but official) replaces the synthetic Markdown stand-in. The document keeps its id, so the
-- four school.* Rule Sources (ADR-0007) still point at it: KKM 3.2 and remedial 3.3 on page 2, input
-- deadline 4.1 and absence 4.3 on page 3. The chunks are what uploadDocument makes of the PDF
-- (pdfToMarkdown, then the chunker); the PDF itself is put in the documents bucket at the storage
-- key below (docs/school-ai.md). Only the untouched seeded document is changed.
--> statement-breakpoint
UPDATE `knowledge_document` SET
  `version` = 'SOP/AKD/03/2026',
  `format` = 'pdf',
  `file_name` = 'F3-2_SOP-Penilaian-SDIT-Nusantara.pdf',
  `content_type` = 'application/pdf',
  `size_bytes` = 4669,
  `storage_key` = 'seed/sekolah/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf'
WHERE `id` = 'sop-penilaian-sdit-nusantara' AND `storage_key` = 'seed/sekolah/SOP-Penilaian-SDIT-Nusantara.md';
--> statement-breakpoint
DELETE FROM `knowledge_chunk`
WHERE `document_id` = 'sop-penilaian-sdit-nusantara'
  AND EXISTS (SELECT 1 FROM `knowledge_document` WHERE `id` = 'sop-penilaian-sdit-nusantara' AND `storage_key` = 'seed/sekolah/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf');
--> statement-breakpoint
INSERT INTO `knowledge_chunk` (`id`, `document_id`, `article`, `section`, `page`, `sequence`, `text`)
SELECT * FROM (VALUES
  ('sop-penilaian-sdit-nusantara-page-1', 'sop-penilaian-sdit-nusantara', NULL, NULL, 1, 0, 'SOP Penilaian Hasil Belajar
SDIT Nusantara
Nomor SOP/AKD/03/2026
Berlaku 1 Juli 2026
Pemilik Wakil Kepala Sekolah Bidang Kurikulum
Disahkan Ahmad Fauzi, M.Pd., Kepala Sekolah
Dokumen uji sintetis untuk workspace Nemu, bukan SOP sekolah nyata.'),
  ('sop-penilaian-sdit-nusantara-page-1-pasal-1.1', 'sop-penilaian-sdit-nusantara', '1.1', NULL, 1, 1, '1. Tujuan
1.1 Menjadi pedoman guru dalam menilai, mencatat, dan memasukkan nilai siswa ke
AlurSekolah secara tepat waktu dan seragam.'),
  ('sop-penilaian-sdit-nusantara-page-1-pasal-2.1', 'sop-penilaian-sdit-nusantara', '2.1', NULL, 1, 2, '2. Ruang lingkup
2.1 Berlaku untuk penilaian harian, Ulangan Tengah Semester (UTS), dan Ulangan Akhir
Semester (UAS) di kelas 1 sampai 6.'),
  ('sop-penilaian-sdit-nusantara-page-1-pasal-2.2', 'sop-penilaian-sdit-nusantara', '2.2', NULL, 1, 3, '2.2 Berlaku untuk semua guru kelas dan guru mata pelajaran.'),
  ('sop-penilaian-sdit-nusantara-page-2-pasal-3.1', 'sop-penilaian-sdit-nusantara', '3.1', NULL, 2, 4, '3. Ketentuan penilaian
3.1 Nilai ditulis dalam skala 0 sampai 100 tanpa desimal.'),
  ('sop-penilaian-sdit-nusantara-page-2-pasal-3.2', 'sop-penilaian-sdit-nusantara', '3.2', NULL, 2, 5, '3.2 Kriteria Ketuntasan Minimal (KKM) untuk semua mata pelajaran adalah 75. Siswa dengan
nilai di bawah 75 wajib mengikuti remedial.'),
  ('sop-penilaian-sdit-nusantara-page-2-pasal-3.3', 'sop-penilaian-sdit-nusantara', '3.3', NULL, 2, 6, '3.3 Remedial diberikan paling banyak 2 kali untuk setiap penilaian. Nilai hasil remedial paling
tinggi 75.'),
  ('sop-penilaian-sdit-nusantara-page-2-pasal-3.4', 'sop-penilaian-sdit-nusantara', '3.4', NULL, 2, 7, '3.4 Nilai di bawah KKM diberi catatan "remedial" pada kolom catatan di AlurSekolah.'),
  ('sop-penilaian-sdit-nusantara-page-2-pasal-3.5', 'sop-penilaian-sdit-nusantara', '3.5', NULL, 2, 8, '3.5 Nilai yang dikoreksi di buku nilai wajib diberi paraf guru di sebelahnya. Nilai yang dipakai
adalah nilai yang diparaf.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-4.1', 'sop-penilaian-sdit-nusantara', '4.1', NULL, 3, 9, '4. Memasukkan nilai ke AlurSekolah
4.1 Nilai UTS dan UAS dimasukkan ke AlurSekolah paling lambat 7 hari kerja setelah ulangan
selesai.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-4.2', 'sop-penilaian-sdit-nusantara', '4.2', NULL, 3, 10, '4.2 Guru memeriksa kembali nilai yang sudah tersimpan melalui menu Rekap Nilai.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-4.3', 'sop-penilaian-sdit-nusantara', '4.3', NULL, 3, 11, '4.3 Siswa yang tidak hadir saat ulangan tidak diberi nilai 0. Kolom nilai dikosongkan dan diberi
keterangan "tidak hadir". Ulangan susulan dilaksanakan paling lambat 14 hari setelah
ulangan.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-5.1', 'sop-penilaian-sdit-nusantara', '5.1', NULL, 3, 12, '5. Penanggung jawab
5.1 Guru: menilai dan memasukkan nilai.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-5.2', 'sop-penilaian-sdit-nusantara', '5.2', NULL, 3, 13, '5.2 Wali kelas: memastikan nilai kelasnya lengkap.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-5.3', 'sop-penilaian-sdit-nusantara', '5.3', NULL, 3, 14, '5.3 Operator: membantu kendala teknis AlurSekolah.'),
  ('sop-penilaian-sdit-nusantara-page-3-pasal-6.1', 'sop-penilaian-sdit-nusantara', '6.1', NULL, 3, 15, '6. Rujukan
6.1 Kalender akademik SDIT Nusantara 2026/2027.')
)
WHERE EXISTS (SELECT 1 FROM `knowledge_document` WHERE `id` = 'sop-penilaian-sdit-nusantara' AND `storage_key` = 'seed/sekolah/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf');
