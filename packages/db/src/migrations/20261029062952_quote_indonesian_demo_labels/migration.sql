-- Quote the Demo App's Indonesian labels (Tugas Saya, Pengajuan Saya, Selesaikan Tugas, Kembali ke tugas,
-- Riwayat) in the seeded travel and telco knowledge, matching data/ and the seed generator's output.
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## 5. Alur di aplikasi

| No | Langkah | Pelaku | Menu |
|---|---|---|---|
| 1 | Terbitkan surat tugas | Kepala Balai | Tugas Saya |
| 2 | Buat pengajuan, pilih jenis perjalanan dan surat tugas | Pelaksana SPD | Ajukan Perjalanan Dinas |
| 3 | Isi jadwal, biaya, dokumen, lalu kirim | Pelaksana SPD | Form pengajuan |
| 4 | Setujui pengajuan | Atasan langsung | Tugas Saya |
| 5 | Uji biaya terhadap SBM, setujui | PPK | Tugas Saya |
| 6 | Bayar uang muka (bila diminta) | Bendahara | Tugas Saya |
| 7 | Geotagging empat titik | Pelaksana SPD | Pengajuan Saya, detail perjalanan |
| 8 | Kirim pertanggungjawaban | Pelaksana SPD | Tugas Saya, task Pertanggungjawaban |
| 9 | Periksa kelengkapan | Verifikator | Tugas Saya |
| 10 | Hitung rampung dan bayar atau tagih selisih | PPK dan Bendahara | Tugas Saya |' WHERE `id` = 'sop-pd-01-section-5';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Menu utama

| Menu | Kode | Fungsi |
|---|---|---|
| Beranda | `[menu-beranda]` | Ringkasan task dan pengajuan aktif |
| Ajukan Perjalanan Dinas | `[menu-ajukan-perjalanan-dinas]` | Membuat pengajuan baru |
| Pengajuan Saya | `[menu-my-request]` | Daftar pengajuan milik saya dan statusnya |
| Tugas Saya | `[menu-my-task]` | Task yang harus saya kerjakan, termasuk Pertanggungjawaban |' WHERE `id` = 'panduan-app-section-1';
--> statement-breakpoint
UPDATE `knowledge_document` SET `size_bytes` = 5299 WHERE `id` = 'sop-pd-01';
--> statement-breakpoint
UPDATE `knowledge_document` SET `size_bytes` = 2482 WHERE `id` = 'panduan-app';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Bab 1. Peta aplikasi

Semua pekerjaan klaim ada di satu alamat AlurKerja App. Menu kiri berisi:

| Menu | Isinya | Dipakai di langkah |
|---|---|---|
| Beranda | Ringkasan task dan tenggat | Awal hari |
| Tugas Saya | Task proses yang ditugaskan ke saya | Semua langkah |
| Mulai Proses | Memulai proses baru, termasuk "Klaim Kompensasi SLA" | Bila klaim belum teregistrasi |
| CRM Layanan | Data pelanggan, service ID, kontrak, adendum | Langkah 2 |
| Tiket NOC | Tiket gangguan dan RCA | Langkah 3 |
| Billing | Invoice dan credit note | Langkah 2 dan 6 |

Tanggal di semua layar mengikuti jam server. Di lingkungan demo, tanggal dikunci ke Rabu, 14 Oktober 2026, pukul 09.00 WIB.' WHERE `id` = 'PA-TN-01-section-1';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Bab 2. Langkah 1: Registrasi Klaim

1. Buka Tugas Saya, pilih task "Registrasi Klaim" dengan nomor klaim yang sesuai, misalnya KLM-2610-0007.
2. Panel task terbuka di kanan. Isi Nomor surat pelanggan dari kop surat.
3. Pilih Service ID dari daftar. Daftar hanya berisi layanan milik pelanggan di surat.
4. Isi Periode gangguan (bulan dan tahun).
5. Isi Tanggal klaim diterima dari stempel email billing, bukan tanggal di kop surat.
6. Isi Jam diklaim pelanggan sesuai surat.
7. Jawab "Diajukan tepat waktu?" sesuai SOP Pasal 2 ayat (1).
8. Unggah surat klaim (PDF), lalu tekan Selesaikan Tugas.' WHERE `id` = 'PA-TN-01-section-2';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Bab 3. Langkah 2: Cocokkan Layanan & Kontrak

1. Di panel task, tekan tautan "Buka di CRM Layanan". Halaman layanan terbuka di tab yang sama.
2. Di CRM Layanan, buka tab "Kontrak & Adendum". SLA dasar tampil di kartu Kontrak. Bila ada adendum yang disahkan, kartu Adendum muncul di bawahnya dan menunjukkan pasal yang diganti.
3. Kembali ke task lewat tombol "Kembali ke tugas".
4. Isi SLA berlaku (%) dan Sumber SLA (kontrak atau adendum).
5. Tekan "Buka invoice". Modul Billing menampilkan invoice periode klaim. Salin nomor invoice, lalu isi Abonemen sebelum PPN.
6. Pilih "Data cocok" atau "Tidak cocok", lalu tekan Selesaikan Tugas.' WHERE `id` = 'PA-TN-01-section-3';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Bab 5. Langkah 4: Susun Berita Acara

1. Tekan "Hitung". Sistem mengisi C, Av, A, B, dan Nominal usulan memakai formula KON-2026-01 Pasal 4.2.
2. Periksa rincian, lalu tekan "Buat draft berita acara". Draft memakai Template TPL-BILL-01.
3. Kolom Rute persetujuan terisi otomatis sesuai MP-BILL-02.
4. Tekan Selesaikan Tugas untuk mengirim ke penyetuju. Tombol ini hanya boleh ditekan oleh Billing Liaison sendiri.' WHERE `id` = 'PA-TN-01-section-5';
--> statement-breakpoint
UPDATE `knowledge_chunk` SET `text` = '## Bab 6. Langkah 5 dan 6: Persetujuan dan Credit Note

1. Status persetujuan bisa dilihat di tab Riwayat pada task.
2. Setelah semua penyetuju setuju, task "Terbitkan Credit Note" muncul di Tugas Saya milik Billing Finance.
3. Billing Liaison tidak perlu melakukan apa pun di langkah ini, kecuali diminta revisi.' WHERE `id` = 'PA-TN-01-section-6';
--> statement-breakpoint
UPDATE `knowledge_document` SET `size_bytes` = 3993 WHERE `id` = 'PA-TN-01';
