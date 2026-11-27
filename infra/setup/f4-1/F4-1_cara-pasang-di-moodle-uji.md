# F4-1 · Cara menyiapkan kuis uji di Moodle

Dikerjakan tim sebelum uji, bukan oleh Nemu. Pakai Moodle uji milik tim (Docker, versi dikunci).

## 1. Kursus dan akun (sekali untuk semua kasus F4)

1. Masuk sebagai admin Moodle uji.
2. Buat kursus **Kelas 4A (uji)**, nama singkat `4A-UJI`. Buat dua bagian: `IPAS` dan `Bahasa Inggris`.
3. Buat akun guru `siti.aminah` (nama Siti Aminah), daftarkan ke `4A-UJI` sebagai Teacher.
4. Akun siswa: Administrasi situs › Pengguna › Unggah pengguna › pilih `F4-3_akun-siswa-uji.csv`. Ketiganya langsung terdaftar di `4A-UJI` sebagai Student.

## 2. Impor soal F4-1

1. Kursus `4A-UJI` › Bank soal › Impor.
2. Format: **Moodle XML**. Berkas: `F4-1_kuis-ipas-4a.xml`. Tekan Impor.
3. Pastikan 15 soal masuk di kategori `IPAS 4A / Kuis Latihan IPAS 4A`.
   - Soal 07 tidak punya jawaban benar. Ini disengaja. Kalau Moodle menampilkan pemberitahuan, biarkan.
   - Soal 15 merujuk `timbangan-3.png` yang tidak ada di berkas. Ini juga disengaja.
4. Kalau versi Moodle uji menolak soal 07, catat di laporan uji. Cadangannya: impor soal 07 dengan "setrika" 100%, lalu ubah nilainya menjadi 0 langsung di database uji (`mdl_question_answers.fraction = 0`). Jangan lewat formulir edit soal, karena formulir mewajibkan satu jawaban 100%.

## 3. Buat kuis

| Isian          | Nilai                                                         |
| -------------- | ------------------------------------------------------------- |
| Bagian         | IPAS                                                          |
| Nama           | Kuis IPAS 4A: Energi, Gaya, dan Peta                          |
| Buka           | Rabu, 2 Desember 2026, 07.00                                  |
| Tutup          | Jumat, 4 Desember 2026, 21.00                                 |
| Nilai maksimal | 100                                                           |
| Soal           | Tambahkan 15 soal dari Bank soal, urut Soal 01 sampai Soal 15 |

Simpan dan tampilkan. Jangan ada siswa yang mengerjakan kuis ini.

## 4. Sebelum uji dimulai

- Catat waktu ubah terakhir kuis (Pengaturan kuis) dan jumlah soal (15). Angka ini dipakai untuk cek "tidak ada yang berubah" di `F4-1_kunci.csv`.
- Masuk ke Moodle di Chrome sebagai `siti.aminah`, buka halaman kuis, lalu guru berkata sambil menahan Ctrl + Spasi: "Nemu, tolong cek kuis ini."

## 5. Kembalikan setelah uji

Kalau ada yang berubah, hapus kuis dan impor ulang dari langkah 2.
