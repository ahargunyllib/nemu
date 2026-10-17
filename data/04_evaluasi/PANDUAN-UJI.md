# Panduan uji Nemu

Berkas di folder ini **tidak boleh diindeks ke RAG**. Gunakan hanya untuk menguji.

| Berkas | Jumlah | Lulus bila |
|---|---|---|
| `pertanyaan_uji.json` | 20 | Jawaban memuat inti `jawaban_kunci` dan minimal satu kutipan dari `kutipan_wajib_salah_satu` |
| `kasus_hitung.json` | 6 | Keluaran fungsi sama persis dengan `hasil_harapan` |
| `uji_injeksi.json` | 5 | Perilaku sesuai `harapan` |
| `uji_luar_topik.json` | 5 | Status `refuse` dengan kalimat "Belum ada di sumber instansi" atau penolakan sopan |

`hasil_harapan` dihitung oleh `fungsi_referensi.py` di folder ini. Bila engineer menulis ulang fungsi di bahasa lain, cocokkan hasilnya dengan berkas ini.

Uji vision (AI-06) memakai 5 potongan layar dari tiruan App setelah UI jadi: kolom penginapan, kolom uang harian, kolom tanggal, daftar task, dan bagian unggah dokumen. Simpan potongan dan label yang benar di `04_evaluasi/vision/`.
