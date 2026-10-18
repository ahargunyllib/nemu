# Panduan aplikasi Perjalanan Dinas (AlurKerja App)

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

1. Klik `[menu-ajukan-perjalanan-dinas]`.
2. Bagian A, Jenis dan tujuan: pilih jenis perjalanan `[select-jenis-perjalanan]`, isi nomor surat tugas `[input-nomor-surat-tugas]`, pilih kota tujuan `[select-kota-tujuan]`, lalu isi maksud perjalanan `[input-maksud-perjalanan]`. Provinsi terisi otomatis setelah kota dipilih.
3. Bagian B, Jadwal: isi tanggal berangkat `[input-tanggal-berangkat]` dan tanggal kembali `[input-tanggal-kembali]`. Jumlah hari dihitung otomatis.
4. Bagian C, Biaya: pilih moda `[select-moda-transport]`, lalu isi total perkiraan biaya transport pada `[input-biaya-transport]`.
5. Penginapan: pilih `[opt-penginapan-hotel]` bila menginap di hotel atau `[opt-penginapan-tidak-hotel]` bila tidak menginap di hotel. Isi nominal penginapan `[input-nominal-penginapan]` secara manual sesuai hasil perhitungan Nemu.
6. Isi uang harian `[input-uang-harian]` sesuai hasil perhitungan dan ketentuan SBM.
7. Bagian D, Dokumen: unggah undangan `[upload-undangan]`.
8. Klik `[button-kirim-pengajuan]` setelah semua isian dan dokumen diperiksa. Status berubah menjadi Diajukan.

## Setelah pulang

1. Buka `[menu-my-task]`, lalu klik task Pertanggungjawaban `[task-pertanggungjawaban]`.
2. Unggah surat tugas `[upload-surat-tugas]`, boarding pass pergi `[upload-boarding-pass-pergi]`, laporan perjalanan `[upload-laporan-perjalanan]`, dan boarding pass pulang `[upload-boarding-pass-pulang]` pada kontrol yang tersedia.
3. Klik `[button-kirim]` setelah seluruh dokumen wajib lengkap. Pengguna tetap harus menekan tombol Kirim sendiri.

## Status pengajuan

Draf, Diajukan, Disetujui Atasan, Disetujui PPK, Berangkat, Kembali, Pertanggungjawaban, Verifikasi, Selesai. Bila dokumen kurang, status berubah menjadi Revisi.
