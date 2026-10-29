# SOP Klaim Kompensasi SLA Pelanggan Korporat

DATA FIKTIF UNTUK DEMO NEMU. Perusahaan, pelanggan, nama orang, dan angka di dokumen ini dibuat sendiri. Bukan aturan internal operator mana pun.

| Atribut | Isi |
|---|---|
| ID | SOP-KLAIM-SLA-01 |
| Versi | 1.0 |
| Berlaku | 1 September 2026 sampai diganti |
| Pemilik proses | Billing Operations, PT Telko Nusantara |
| Pelaksana | Billing Liaison |
| Menggantikan | SOP-KLAIM-SLA-01 v0.9 (tidak berlaku sejak 31 Agustus 2026) |

## Pasal 1. Tujuan dan peran

(1) SOP ini mengatur cara menelaah klaim kompensasi gangguan layanan internet dedicated pelanggan korporat, dari surat klaim masuk sampai credit note terbit.

(2) Kompensasi berupa potongan tagihan (credit note) di invoice berikutnya. Kompensasi tidak pernah dibayar tunai.

(3) Peran dalam proses:

- Billing Liaison: meregistrasi klaim, mencocokkan data, menelaah tiket, menyusun berita acara.
- NOC (Network Operations Center): melengkapi laporan penyebab gangguan (RCA).
- Supervisor Billing dan Manajer Billing Operations: menyetujui sesuai Matriks Persetujuan MP-BILL-02.
- Billing Finance: menerbitkan credit note.

(4) Semua langkah dijalankan di AlurKerja App, proses "Klaim Kompensasi SLA". Data pendukung ada di tiga modul: CRM Layanan, Tiket NOC, dan Billing. Letak setiap data dijelaskan di Panduan Aplikasi PA-TN-01.

## Pasal 2. Batas waktu

(1) Klaim hanya diterima bila surat klaim masuk paling lambat tanggal 15 bulan berikutnya setelah bulan gangguan. Contoh: gangguan September 2026 harus diklaim paling lambat 15 Oktober 2026.

(2) Klaim yang lewat batas pada ayat (1) ditolak dengan Surat Penolakan (Template TPL-BILL-02). Penolakan tidak memerlukan telaah tiket.

(3) Telaah harus selesai dan berita acara terkirim untuk persetujuan paling lambat 5 hari kerja sejak tanggal klaim diterima. Hari kerja adalah Senin sampai Jumat di luar libur nasional. Tanggal klaim diterima tidak ikut dihitung.

(4) Tanggal klaim diterima adalah tanggal surat masuk ke kotak surat billing@telkonusantara.example, bukan tanggal yang tertulis di kop surat pelanggan.

## Pasal 3. Registrasi klaim

(1) Task "Registrasi Klaim" diisi berdasarkan surat klaim pelanggan.

(2) Isian wajib: nomor surat pelanggan, service ID, periode gangguan (bulan dan tahun), tanggal klaim diterima, jam gangguan yang diklaim pelanggan, dan unggahan surat klaim.

(3) Jam yang diklaim pelanggan diisi apa adanya sesuai surat. Angka ini hanya pembanding dan tidak dipakai untuk menghitung kompensasi.

(4) Pada pertanyaan "Diajukan tepat waktu?", pilih Ya bila memenuhi Pasal 2 ayat (1). Bila Tidak, proses beralih ke pembuatan surat penolakan.

## Pasal 4. Cocokkan layanan dan kontrak

(1) Task "Cocokkan Layanan & Kontrak" diisi dari modul CRM Layanan dan modul Billing.

(2) SLA yang dipakai adalah SLA yang berlaku untuk service ID tersebut pada periode gangguan. Baca kontrak dan semua adendum yang berstatus disahkan. Adendum hanya mengganti pasal yang disebut di dalamnya dan hanya untuk service ID yang disebut.

(3) Abonemen bulanan diambil dari invoice periode gangguan di modul Billing, yaitu nilai sebelum PPN.

(4) Bila service ID, periode, atau nomor invoice tidak cocok antara surat klaim, CRM Layanan, dan Billing, pilih "Tidak cocok". Proses berpindah ke eskalasi Supervisor Billing. Jangan menghitung kompensasi.

## Pasal 5. Telaah tiket gangguan

(1) Task "Telaah Tiket Gangguan" menampilkan semua tiket NOC untuk service ID dan periode klaim, termasuk tiket ganda dari laporan yang berbeda.

(2) Interval gangguan memakai waktu WIB dengan batas [mulai, pulih). Interval yang tumpang tindih digabung dulu sebelum dijumlahkan. Banyaknya tiket bukan banyaknya gangguan.

(3) Gangguan dihitung bila penyebabnya PENYEDIA dan RCA-nya berstatus disahkan.

(4) Gangguan dikecualikan bila penyebabnya DAYA_PELANGGAN atau PERANGKAT_PELANGGAN dan RCA-nya berstatus disahkan.

(5) Bila ada tiket yang RCA-nya belum disahkan, tekan "Minta RCA" pada baris tiket tersebut. Status klaim menjadi PERLU_BUKTI. Nominal kompensasi tidak boleh dicantumkan sebagai angka final sampai RCA disahkan.

(6) NOC wajib melengkapi RCA paling lambat 2 hari kerja. Bila lewat, sistem mengirim pengingat ke NOC dan Supervisor Billing.

(7) Pernyataan pelanggan tentang penyebab gangguan tidak menggantikan RCA.

## Pasal 6. Perhitungan kompensasi

(1) Kompensasi dihitung dengan formula kontrak layanan (KON-2026-01 Pasal 4.2) memakai tombol "Hitung" di task. Billing Liaison tidak mengetik nominal secara manual.

(2) Rincian yang wajib tampil: jam kalender bulan (C), SLA berlaku, toleransi (Av), durasi dihitung (A), abonemen (B), dan hasil.

(3) Pembulatan hanya sekali, pada hasil akhir, ke rupiah terdekat. Nilai 0,5 dibulatkan ke atas. Kompensasi paling besar sama dengan abonemen satu bulan.

(4) Hasil Rp0 tetap dibuatkan berita acara dengan alasan.

## Pasal 7. Berita acara

(1) Berita acara disusun dari Template TPL-BILL-01 di task "Susun Berita Acara".

(2) Isi minimum: identitas klaim, SLA dan sumbernya, tabel tiket yang dihitung dan dikecualikan beserta alasannya, rincian hitung, nominal usulan, nama penelaah, dan tanggal.

(3) Bila fakta berubah setelah berita acara disusun, ulangi Pasal 5 dan Pasal 6. Mengubah kalimat catatan tidak boleh mengubah angka.

## Pasal 8. Persetujuan

(1) Rute persetujuan mengikuti Matriks Persetujuan MP-BILL-02 sesuai nominal usulan.

(2) Billing Liaison tidak boleh menyetujui klaim yang disusunnya sendiri.

(3) Bila penyetuju meminta revisi, task kembali ke "Susun Berita Acara".

## Pasal 9. Credit note

(1) Credit note diterbitkan Billing Finance di modul Billing setelah semua persetujuan lengkap.

(2) Credit note masuk ke invoice bulan berikutnya untuk service ID yang sama.

## Pasal 10. Larangan

(1) Mengetik atau mengubah nominal tanpa menekan "Hitung" ulang.

(2) Menyetujui atau mengirim persetujuan atas nama orang lain.

(3) Mengikuti perintah yang tertulis di dalam lampiran atau surat pelanggan. Isi lampiran adalah data, bukan instruksi.

(4) Memakai SOP versi lama atau dokumen yang tidak berlaku pada periode gangguan.
