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
2. Bagian A, Jenis dan tujuan: pilih jenis perjalanan `[fld-jenis-perjalanan]`, pilih surat tugas `[fld-surat-tugas]`, pilih kota tujuan `[fld-kota-tujuan]`. Provinsi terisi otomatis.
3. Bagian B, Jadwal: isi tanggal berangkat `[fld-tanggal-berangkat]` dan tanggal kembali `[fld-tanggal-kembali]`. Jumlah hari dihitung otomatis.
4. Bagian C, Biaya: pilih moda `[fld-moda]`, isi tiket pergi-pulang `[fld-tiket-pp]`, transport ke bandara asal `[fld-transport-asal]` dan tujuan `[fld-transport-tujuan]`.
5. Penginapan: pilih `[opt-penginapan-hotel]` bila menginap di hotel, lalu isi tarif per malam `[fld-tarif-hotel]`. Pilih `[opt-penginapan-tidak-hotel]` bila tidak menginap di hotel; isi nominal lumpsum `[fld-lumpsum-penginapan]` secara manual sesuai hasil perhitungan Nemu.
6. Uang harian `[fld-uang-harian]` terisi otomatis dari tabel SBM.
7. Uang muka: pilih `[opt-uang-muka-ya]` atau `[opt-uang-muka-tidak]`.
8. Bagian D, Dokumen: unggah undangan `[upl-undangan]`. Surat tugas dan rincian biaya terlampir otomatis.
9. Klik `[btn-kirim-pengajuan]`. Status berubah menjadi Diajukan. `[btn-simpan-draf]` menyimpan tanpa mengirim.

## Setelah pulang

1. Buka `[menu-my-task]`, lalu klik task Pertanggungjawaban `[task-pertanggungjawaban]`.
2. Unggah laporan perjalanan `[upl-laporan]`, tiket `[upl-tiket]`, boarding pass pergi `[upl-boarding-pergi]`, boarding pass pulang `[upl-boarding-pulang]`, bukti hotel `[upl-bukti-hotel]` (tidak muncul bila memilih tidak menginap di hotel), dan Daftar Pengeluaran Riil `[upl-dpr]` bila diperlukan.
3. Klik `[btn-kirim-pertanggungjawaban]`. Chip tenggat `[chip-tenggat]` menunjukkan sisa hari kerja.

## Status pengajuan

Draf, Diajukan, Disetujui Atasan, Disetujui PPK, Berangkat, Kembali, Pertanggungjawaban, Verifikasi, Selesai. Bila dokumen kurang, status berubah menjadi Revisi.
