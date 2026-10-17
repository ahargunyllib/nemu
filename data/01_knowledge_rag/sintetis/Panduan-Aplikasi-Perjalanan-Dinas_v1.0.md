# Panduan aplikasi Perjalanan Dinas

SINTETIS · dokumen contoh untuk demo Nemu · bukan dokumen resmi instansi mana pun

Panduan ini menjelaskan menu dan isian di aplikasi Perjalanan Dinas milik Balai Layanan Digital Wilayah Yogyakarta, Kementerian Contoh. Kode di dalam tanda `[ ]` adalah `data-nemu-id` elemen di layar.

## Menu utama

| Menu | Kode | Fungsi |
|---|---|---|
| Beranda | `[menu-beranda]` | Ringkasan task dan pengajuan aktif |
| Ajukan Perjalanan Dinas | `[menu-ajukan-perjalanan-dinas]` | Membuat pengajuan baru |
| My Request | `[menu-my-request]` | Daftar pengajuan milik saya dan statusnya |
| My Task | `[menu-my-task]` | Task yang harus saya kerjakan, termasuk Pertanggungjawaban |

## Membuat pengajuan

1. Klik `[menu-ajukan-perjalanan-dinas]`. Formulir terdiri atas empat bagian dan semua isian wajib diisi.
2. Bagian A, Jenis dan tujuan: pilih jenis perjalanan `[select-jenis-perjalanan]` (Perjalanan dinas luar kota atau Perjalanan dinas dalam kota), isi nomor surat tugas `[input-nomor-surat-tugas]`, pilih kota tujuan `[select-kota-tujuan]`, dan isi maksud perjalanan `[input-maksud-perjalanan]`. Provinsi terisi otomatis dari kota tujuan.
3. Bagian B, Jadwal: isi tanggal berangkat `[input-tanggal-berangkat]` dan tanggal kembali `[input-tanggal-kembali]`. Lama perjalanan dalam hari dan malam dihitung otomatis. Tanggal kembali tidak boleh sebelum tanggal berangkat.
4. Bagian C, Biaya: pilih moda transportasi `[select-moda-transport]` (Pesawat, Kereta api, Bus, atau Kendaraan dinas), lalu isi biaya transportasi pergi-pulang `[input-biaya-transport]` dalam rupiah.
5. Penginapan: pilih `[opt-penginapan-hotel]` (Menginap di hotel) atau `[opt-penginapan-tidak-hotel]` (Tidak menginap di hotel). Lalu isi nominal penginapan `[input-nominal-penginapan]`, yaitu total biaya penginapan selama perjalanan. Bila tidak menginap di hotel, isi dengan lumpsum penginapan sesuai ketentuan yang berlaku.
6. Uang harian: isi `[input-uang-harian]` dengan total uang harian untuk seluruh hari perjalanan. Nominal ini tidak terisi otomatis.
7. Bagian D, Dokumen: unggah undangan kegiatan `[upload-undangan]` dalam bentuk PDF atau gambar. Surat tugas dan rincian biaya terlampir otomatis.
8. Klik Kirim `[button-kirim-pengajuan]`. Pengajuan tersimpan dengan status Diajukan. Formulir tidak bisa disimpan sebagai draf, jadi lengkapi semua isian sebelum mengirim.

## Setelah pulang

1. Buka Beranda `[menu-beranda]` atau My Task `[menu-my-task]`, lalu klik task Pertanggungjawaban `[task-pertanggungjawaban]`.
2. Unggah empat dokumen: surat tugas `[upload-surat-tugas]`, boarding pass pergi `[upload-boarding-pass-pergi]`, boarding pass pulang `[upload-boarding-pass-pulang]`, dan laporan perjalanan `[upload-laporan-perjalanan]`. Dokumen yang sudah terunggah menampilkan nama berkasnya.
3. Klik Kirim `[button-kirim]`. Kirim hanya berhasil bila keempat dokumen sudah terunggah. Status berubah menjadi Verifikasi dan halaman menampilkan ID tugas, misalnya `PJ-PD-2026-0042`.

## Status pengajuan

Draf, Diajukan, Disetujui, Berangkat, Kembali, Pertanggungjawaban, Verifikasi, Selesai. Bila pengajuan perlu diperbaiki, statusnya menjadi Revisi lalu kembali ke Diajukan setelah diperbaiki. Status pengajuan terlihat di My Request `[menu-my-request]`.

Hanya tiga status yang memberi task kepada pegawai: Draf memberi task Isi rencana perjalanan `[task-isi-rencana]`, Revisi memberi task Perbaiki pengajuan `[task-revisi]`, dan Pertanggungjawaban memberi task Pertanggungjawaban `[task-pertanggungjawaban]`. Status lain menunggu atasan, PPK, atau bendahara.
