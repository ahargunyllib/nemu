# Perjanjian Layanan Internet Dedicated

DATA FIKTIF UNTUK DEMO NEMU. Perusahaan, pelanggan, nama orang, dan angka di dokumen ini dibuat sendiri. Bukan aturan internal operator mana pun.

| Atribut | Isi |
|---|---|
| ID | KON-2026-01 |
| Penyedia | PT Telko Nusantara (fiktif) |
| Pelanggan | PT Arunika Retail (fiktif) |
| Ditandatangani | 25 Agustus 2026 |
| Masa berlaku | 1 September 2026 sampai 31 Agustus 2027 |
| Status | Disahkan |

## Pasal 1. Para pihak

PT Telko Nusantara sebagai penyedia layanan dan PT Arunika Retail sebagai pelanggan sepakat atas layanan internet dedicated untuk lokasi di Pasal 2.

## Pasal 2. Daftar layanan

| Service ID | Lokasi | Bandwidth | Abonemen per bulan (sebelum PPN) |
|---|---|---|---|
| TN-ENT-001 | Kantor pusat, Jakarta Selatan | 100 Mbps | Rp30.000.000 |
| TN-ENT-002 | Gudang distribusi, Cikarang | 100 Mbps | Rp30.000.000 |
| TN-ENT-003 | Toko flagship, Bandung | 50 Mbps | Rp12.000.000 |

TN-ENT-001 dan TN-ENT-002 aktif sejak 1 September 2026. TN-ENT-003 sudah aktif sejak 1 Agustus 2026 dengan perjanjian sementara dan masuk kontrak ini mulai 1 September 2026.

## Pasal 3. Lingkup gangguan

(1) Gangguan adalah terputusnya layanan sampai pulih, berdasarkan tiket NOC dan laporan penyebab gangguan (RCA) yang disahkan.

(2) Penurunan kecepatan tanpa putus tidak dihitung sebagai gangguan.

(3) Periode perhitungan adalah satu bulan kalender, waktu WIB.

## Pasal 4. SLA dan kompensasi

### 4.1 Target ketersediaan

Target ketersediaan adalah 99,00% per bulan untuk setiap layanan, kecuali diganti oleh adendum yang disahkan untuk layanan tersebut.

### 4.2 Formula kompensasi

- C = jumlah jam kalender pada bulan gangguan. Contoh: September = 30 × 24 = 720 jam.
- Av = (1 − SLA/100) × C. Ini toleransi gangguan yang tidak dikompensasi.
- A = total jam gangguan yang menjadi tanggung jawab penyedia, setelah interval tumpang tindih digabung.
- B = abonemen bulanan sebelum PPN.
- Kompensasi = min(B, max(0, (A − Av) / C × B)).

Hasil akhir dibulatkan ke rupiah terdekat, 0,5 ke atas. A dan Av tidak dibulatkan.

### 4.3 Pengecualian

Gangguan karena daya listrik atau perangkat milik pelanggan dikecualikan bila RCA yang disahkan menunjukkan hubungan waktu dan sebabnya. Pernyataan pelanggan saja tidak cukup untuk mengecualikan atau memasukkan gangguan.

### 4.4 Bentuk kompensasi

Kompensasi diberikan sebagai credit note pada invoice bulan berikutnya, paling besar satu kali abonemen bulan terkait.

## Pasal 5. Pengajuan klaim

Pelanggan mengajukan klaim tertulis paling lambat tanggal 15 bulan berikutnya, dengan menyebut service ID, periode, nomor invoice, dan perkiraan jam gangguan.

## Pasal 6. Perubahan

Perubahan ketentuan dilakukan lewat adendum yang menyebut service ID, pasal yang diganti, tanggal efektif, dan status pengesahan. Rancangan adendum yang belum disahkan tidak berlaku.
