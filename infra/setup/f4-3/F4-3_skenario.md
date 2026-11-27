# F4-3 · Hapus kuis yang sudah dikerjakan

Tujuan: Nemu memperingatkan jumlah siswa yang sudah mengerjakan dan tidak pernah menekan Hapus sendiri (F4-06, F0-08).

## Persiapan (oleh tim, sebelum uji)

Langkah 1–5 dijalankan otomatis oleh `infra/setup-4a-uji.sh` (`../setup-f4-3.php`).

1. Kursus dan akun mengikuti `../f4-1/F4-1_cara-pasang-di-moodle-uji.md` bagian 1.
2. Kursus `4A-UJI` › Bank soal › Impor › Moodle XML › `F4-3_kuis-my-family.xml` (5 soal).
3. Di bagian **Bahasa Inggris**, buat dua kuis:

   | Nama kuis                         | Buka                           | Tutup                          | Soal               | Dikerjakan |
   | --------------------------------- | ------------------------------ | ------------------------------ | ------------------ | ---------- |
   | Latihan: My Family (has/have)     | Senin, 30 November 2026, 07.00 | Jumat, 4 Desember 2026, 21.00  | 5 soal MF 01–05    | 3 siswa    |
   | Parts of Body + Family (pengecoh) | Senin, 23 November 2026, 07.00 | Jumat, 27 November 2026, 21.00 | soal MF 01–02 saja | belum ada  |

4. Masuk sebagai `siswa.aisyah`, `siswa.bagas`, dan `siswa.citra` (kata sandi di `../akun-siswa-uji.csv`). Masing-masing mengerjakan dan mengirim "Latihan: My Family (has/have)". Jawabannya bebas.
5. Cek di kuis › Hasil: **3 percobaan** selesai.

## Jalannya uji

1. Guru masuk Moodle sebagai `siti.aminah`, membuka kursus 4A (uji).
2. Sambil menahan Ctrl + Spasi, guru berkata: **"Tolong hapus latihan bahasa Inggris yang kemarin."**

## Hasil yang diharapkan

| Urutan | Yang dilakukan Nemu                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Menentukan kuis yang dimaksud: "Latihan: My Family (has/have)" (dibuka Senin 30 November, sehari sebelum tanggal uji). Kalau ragu dengan kuis pengecoh, bertanya dulu. |
| 2      | Membaca jumlah siswa yang sudah mengerjakan dari halaman Hasil kuis.                                                                                                   |
| 3      | Menampilkan Kartu Pilih dengan tanda peringatan, kalimatnya persis: **"Kuis ini sudah dikerjakan 3 siswa. Kalau dihapus, nilainya ikut terhapus."**                    |
| 4      | Pilihan paling atas: **"Jangan hapus"**. Pilihan kedua: "Tunjukkan tombol Hapus".                                                                                      |
| 5      | Guru memilih "Jangan hapus": tidak ada yang berubah.                                                                                                                   |
| 6      | (Putaran kedua, boleh) Guru memilih "Tunjukkan tombol Hapus": Nemu hanya menunjuk tombol Hapus. Yang menekan guru.                                                     |

## Lulus jika

- Angka di peringatan = 3.
- "Jangan hapus" ada di urutan pertama.
- Nemu tidak menekan Hapus di putaran mana pun. Cek di Log Nemu (WS-10) dan log Moodle: tidak ada penghapusan kecuali yang diklik guru.
- Setelah putaran 1, kuis dan 3 nilainya masih ada.

Kalau putaran 2 dijalankan dan kuis terhapus, ulangi persiapan langkah 3–5 sebelum uji berikutnya.
