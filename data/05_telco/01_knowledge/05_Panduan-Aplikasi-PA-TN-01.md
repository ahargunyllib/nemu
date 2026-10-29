# Panduan Aplikasi: Klaim Kompensasi SLA di AlurKerja App

DATA FIKTIF UNTUK DEMO NEMU. Perusahaan, pelanggan, nama orang, dan angka di dokumen ini dibuat sendiri. Bukan aturan internal operator mana pun.

| Atribut | Isi |
|---|---|
| ID | PA-TN-01 |
| Versi | 1.0 |
| Berlaku | 1 September 2026 |
| Untuk | Billing Liaison PT Telko Nusantara |

## Bab 1. Peta aplikasi

Semua pekerjaan klaim ada di satu alamat AlurKerja App. Menu kiri berisi:

| Menu | Isinya | Dipakai di langkah |
|---|---|---|
| Beranda | Ringkasan task dan tenggat | Awal hari |
| Tugas Saya | Task proses yang ditugaskan ke saya | Semua langkah |
| Mulai Proses | Memulai proses baru, termasuk "Klaim Kompensasi SLA" | Bila klaim belum teregistrasi |
| CRM Layanan | Data pelanggan, service ID, kontrak, adendum | Langkah 2 |
| Tiket NOC | Tiket gangguan dan RCA | Langkah 3 |
| Billing | Invoice dan credit note | Langkah 2 dan 6 |

Tanggal di semua layar mengikuti jam server. Di lingkungan demo, tanggal dikunci ke Rabu, 14 Oktober 2026, pukul 09.00 WIB.

## Bab 2. Langkah 1: Registrasi Klaim

1. Buka Tugas Saya, pilih task "Registrasi Klaim" dengan nomor klaim yang sesuai, misalnya KLM-2610-0007.
2. Panel task terbuka di kanan. Isi Nomor surat pelanggan dari kop surat.
3. Pilih Service ID dari daftar. Daftar hanya berisi layanan milik pelanggan di surat.
4. Isi Periode gangguan (bulan dan tahun).
5. Isi Tanggal klaim diterima dari stempel email billing, bukan tanggal di kop surat.
6. Isi Jam diklaim pelanggan sesuai surat.
7. Jawab "Diajukan tepat waktu?" sesuai SOP Pasal 2 ayat (1).
8. Unggah surat klaim (PDF), lalu tekan Selesaikan Tugas.

## Bab 3. Langkah 2: Cocokkan Layanan & Kontrak

1. Di panel task, tekan tautan "Buka di CRM Layanan". Halaman layanan terbuka di tab yang sama.
2. Di CRM Layanan, buka tab "Kontrak & Adendum". SLA dasar tampil di kartu Kontrak. Bila ada adendum yang disahkan, kartu Adendum muncul di bawahnya dan menunjukkan pasal yang diganti.
3. Kembali ke task lewat tombol "Kembali ke tugas".
4. Isi SLA berlaku (%) dan Sumber SLA (kontrak atau adendum).
5. Tekan "Buka invoice". Modul Billing menampilkan invoice periode klaim. Salin nomor invoice, lalu isi Abonemen sebelum PPN.
6. Pilih "Data cocok" atau "Tidak cocok", lalu tekan Selesaikan Tugas.

## Bab 4. Langkah 3: Telaah Tiket Gangguan

1. Tabel tiket otomatis berisi semua tiket NOC untuk service ID dan periode klaim.
2. Kolom Penyebab dan Status RCA berasal dari modul Tiket NOC. Klik nomor RCA untuk membuka laporannya.
3. Untuk setiap tiket, pilih Dihitung atau Dikecualikan, dan isi alasan singkat.
4. Tiket yang intervalnya tumpang tindih diberi ikon rantai. Tekan "Gabungkan interval" agar durasinya tidak terhitung dua kali.
5. Bila Status RCA bukan Disahkan, tekan "Minta RCA" di baris itu. Task menunggu jawaban NOC.
6. Ringkasan di bawah tabel menampilkan Durasi dihitung (A) dan pembanding jam yang diklaim pelanggan.

## Bab 5. Langkah 4: Susun Berita Acara

1. Tekan "Hitung". Sistem mengisi C, Av, A, B, dan Nominal usulan memakai formula KON-2026-01 Pasal 4.2.
2. Periksa rincian, lalu tekan "Buat draft berita acara". Draft memakai Template TPL-BILL-01.
3. Kolom Rute persetujuan terisi otomatis sesuai MP-BILL-02.
4. Tekan Selesaikan Tugas untuk mengirim ke penyetuju. Tombol ini hanya boleh ditekan oleh Billing Liaison sendiri.

## Bab 6. Langkah 5 dan 6: Persetujuan dan Credit Note

1. Status persetujuan bisa dilihat di tab Riwayat pada task.
2. Setelah semua penyetuju setuju, task "Terbitkan Credit Note" muncul di Tugas Saya milik Billing Finance.
3. Billing Liaison tidak perlu melakukan apa pun di langkah ini, kecuali diminta revisi.

## Bab 7. Istilah

| Istilah | Arti |
|---|---|
| SLA | Target ketersediaan layanan per bulan, dalam persen |
| RCA | Root cause analysis, laporan penyebab gangguan dari NOC |
| Credit note | Potongan tagihan di invoice berikutnya |
| PERLU_BUKTI | Status klaim yang menunggu RCA |
| Tiket ganda | Dua tiket atau lebih untuk gangguan yang sama |
