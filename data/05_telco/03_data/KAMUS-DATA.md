# Kamus data kasus 2

Semua data fiktif. Waktu memakai WIB (+07:00) dan format ISO 8601. Nominal dalam rupiah bulat.

| Berkas | Isi | Kunci |
|---|---|---|
| services.csv | Layanan pelanggan, kontrak, adendum, SLA dasar dan SLA berlaku | service_id |
| invoices.csv | Invoice bulanan. Abonemen sebelum PPN dipakai sebagai B | invoice_id |
| tickets.csv | Tiket gangguan NOC. Interval [mulai, pulih) | ticket_id |
| rca.csv | Laporan penyebab gangguan. Satu RCA bisa menjelaskan beberapa tiket | rca_id |
| claims.csv | Surat klaim pelanggan yang masuk. Kolom fixture menunjuk kasus uji | claim_id |
| users.csv | Akun demo dan peran | user_id |
| seed.json | Jam demo, user login, dan task awal di My Tasks | task_id |

Catatan:

- sla_berlaku_persen di services.csv adalah hasil membaca kontrak dan adendum. Mock app boleh menampilkannya di CRM, tapi Nemu harus bisa menjelaskan sumbernya (ADD-2026-02 Pasal 1) dari dokumen pengetahuan.
- durasi_jam di tickets.csv adalah durasi per tiket sebelum digabung. Jangan dijumlahkan langsung.
- PPN dihitung 12% × DPP nilai lain (11/12 × abonemen). Ini hanya untuk tampilan invoice dan tidak dipakai dalam hitungan kompensasi.
