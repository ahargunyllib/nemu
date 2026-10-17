"""Fungsi referensi Nemu untuk lookup SBM 2026 dan hitungan perjalanan dinas.

Dipakai untuk menghasilkan hasil_harapan di 04_evaluasi/kasus_hitung.json.
Engineer boleh menulis ulang di bahasa lain; hasilnya harus sama.
Tabel dibaca dari folder 02_tabel di samping folder 04_evaluasi.
"""
import csv
import datetime as dt
from pathlib import Path

HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

# SKB 3 Menteri No. 1497, 2, 5 Tahun 2025 (libur nasional dan cuti bersama 2026)
LIBUR_2026_DETAIL = [
    ("2026-01-01", "libur_nasional", "Tahun Baru 2026 Masehi"),
    ("2026-01-16", "libur_nasional", "Isra Mikraj Nabi Muhammad SAW"),
    ("2026-02-16", "cuti_bersama", "Cuti bersama Tahun Baru Imlek"),
    ("2026-02-17", "libur_nasional", "Tahun Baru Imlek 2577 Kongzili"),
    ("2026-03-18", "cuti_bersama", "Cuti bersama Hari Suci Nyepi"),
    ("2026-03-19", "libur_nasional", "Hari Suci Nyepi Tahun Baru Saka 1948"),
    ("2026-03-20", "cuti_bersama", "Cuti bersama Idul Fitri 1447 H"),
    ("2026-03-21", "libur_nasional", "Idul Fitri 1447 H"),
    ("2026-03-22", "libur_nasional", "Idul Fitri 1447 H"),
    ("2026-03-23", "cuti_bersama", "Cuti bersama Idul Fitri 1447 H"),
    ("2026-03-24", "cuti_bersama", "Cuti bersama Idul Fitri 1447 H"),
    ("2026-04-03", "libur_nasional", "Wafat Yesus Kristus"),
    ("2026-04-05", "libur_nasional", "Kebangkitan Yesus Kristus (Paskah)"),
    ("2026-05-01", "libur_nasional", "Hari Buruh Internasional"),
    ("2026-05-14", "libur_nasional", "Kenaikan Yesus Kristus"),
    ("2026-05-15", "cuti_bersama", "Cuti bersama Kenaikan Yesus Kristus"),
    ("2026-05-27", "libur_nasional", "Idul Adha 1447 H"),
    ("2026-05-28", "cuti_bersama", "Cuti bersama Idul Adha 1447 H"),
    ("2026-05-31", "libur_nasional", "Hari Raya Waisak 2570 BE"),
    ("2026-06-01", "libur_nasional", "Hari Lahir Pancasila"),
    ("2026-06-16", "libur_nasional", "Tahun Baru Islam 1448 H"),
    ("2026-08-17", "libur_nasional", "Hari Proklamasi Kemerdekaan RI"),
    ("2026-08-25", "libur_nasional", "Maulid Nabi Muhammad SAW"),
    ("2026-12-24", "cuti_bersama", "Cuti bersama Hari Raya Natal"),
    ("2026-12-25", "libur_nasional", "Hari Raya Natal"),
]
LIBUR = {dt.date.fromisoformat(d) for d, _, _ in LIBUR_2026_DETAIL}

KOTA_PROVINSI = {
    "YOGYAKARTA": "DI YOGYAKARTA", "MAKASSAR": "SULAWESI SELATAN", "JAKARTA": "DKI JAKARTA",
    "SURABAYA": "JAWA TIMUR", "SEMARANG": "JAWA TENGAH", "BANDUNG": "JAWA BARAT", "DENPASAR": "BALI",
    "MEDAN": "SUMATERA UTARA", "BALIKPAPAN": "KALIMANTAN TIMUR", "MANADO": "SULAWESI UTARA",
}

KOLOM_PENGINAPAN = {
    "pejabat negara / wakil menteri / eselon I": "pejabat_negara_eselon_I",
    "pejabat negara lainnya / eselon II": "pejabat_negara_lainnya_eselon_II",
    "eselon III / golongan IV": "eselon_III_golongan_IV",
    "eselon IV / golongan III, II, I": "eselon_IV_golongan_III_II_I",
}

TABEL = Path(__file__).resolve().parent.parent / "02_tabel"


def _baca(nama):
    with (TABEL / nama).open(encoding="utf-8") as f:
        return {r["provinsi"]: r for r in csv.DictReader(f)}


def _kolom_golongan(golongan):
    g = golongan.split("/")[0].strip().upper()
    return "eselon_III_golongan_IV" if g == "IV" else "eselon_IV_golongan_III_II_I"


def lookup_sbm(provinsi, komponen, golongan=None, jenis="luar_kota"):
    """komponen: 'uang_harian' | 'penginapan' | 'transport_bandara'."""
    if komponen == "uang_harian":
        return int(_baca("sbm2026_uang_harian_dalam_negeri.csv")[provinsi][jenis])
    if komponen == "penginapan":
        return int(_baca("sbm2026_penginapan_dalam_negeri.csv")[provinsi][_kolom_golongan(golongan)])
    if komponen == "transport_bandara":
        return int(_baca("sbm2026_transport_terminal_bandara.csv")[provinsi]["besaran_per_orang_per_kali"])
    raise ValueError(komponen)


def hitung_lumpsum_penginapan(provinsi, golongan, malam):
    tarif = lookup_sbm(provinsi, "penginapan", golongan)
    per_malam = round(tarif * 30 / 100)
    return {"tarif_hotel_sbm": tarif, "persen": 30, "per_malam": per_malam, "malam": malam, "total": per_malam * malam,
            "dasar": "PMK 119/2023 Pasal 8 ayat (5); PMK 32/2025 Lampiran I angka 30"}


def uang_harian(provinsi, jenis, hari):
    tarif = lookup_sbm(provinsi, "uang_harian", jenis=jenis)
    return {"tarif_per_hari": tarif, "hari": hari, "total": tarif * hari, "dasar": "PMK 32/2025 Lampiran I angka 28.1"}


def cek_tarif_hotel(provinsi, golongan, tarif):
    batas = lookup_sbm(provinsi, "penginapan", golongan)
    return {"batas_sbm": batas, "tarif": tarif, "melebihi": tarif > batas, "selisih": max(0, tarif - batas),
            "dasar": "PMK 32/2025 Lampiran I angka 30 (batas tertinggi)"}


def hari_kerja(d):
    return d.weekday() < 5 and d not in LIBUR


def batas_pertanggungjawaban(tanggal_kembali):
    d = dt.date.fromisoformat(tanggal_kembali)
    hitung = 0
    while hitung < 5:
        d += dt.timedelta(days=1)
        if hari_kerja(d):
            hitung += 1
    return {"tanggal_kembali": tanggal_kembali, "batas": d.isoformat(), "hari": HARI[d.weekday()],
            "dasar": "PMK 113/2012 Pasal 34 ayat (1): paling lambat 5 hari kerja setelah perjalanan dinas"}


def sisa_hari_kerja(tanggal_kembali, hari_ini):
    batas = dt.date.fromisoformat(batas_pertanggungjawaban(tanggal_kembali)["batas"])
    d, n = dt.date.fromisoformat(hari_ini), 0
    while d <= batas:
        n += hari_kerja(d)
        d += dt.timedelta(days=1)
    return {"hari_ini": hari_ini, "batas": batas.isoformat(), "sisa_hari_kerja_termasuk_hari_ini": n}


def rincian_perkiraan(provinsi, golongan, berangkat, kembali, tiket_pp, transport_asal, transport_tujuan, menginap_hotel,
                      tarif_hotel=None):
    hari = (dt.date.fromisoformat(kembali) - dt.date.fromisoformat(berangkat)).days + 1
    malam = hari - 1
    uh = uang_harian(provinsi, "luar_kota", hari)["total"]
    if menginap_hotel:
        inap = (tarif_hotel or lookup_sbm(provinsi, "penginapan", golongan)) * malam
    else:
        inap = hitung_lumpsum_penginapan(provinsi, golongan, malam)["total"]
    total = uh + inap + tiket_pp + transport_asal + transport_tujuan
    return {"hari": hari, "malam": malam, "uang_harian": uh, "penginapan": inap, "tiket_pp": tiket_pp,
            "transport_asal": transport_asal, "transport_tujuan": transport_tujuan, "total": total}
