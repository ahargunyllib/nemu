-- Data yang disimpan halaman tiruan AlurSekolah. Terpisah dari D1 Nemu Service.
CREATE TABLE nilai (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester TEXT NOT NULL,
  kelas TEXT NOT NULL,
  mapel TEXT NOT NULL,
  jenis TEXT NOT NULL,
  nis TEXT NOT NULL,
  nama_siswa TEXT NOT NULL,
  skor REAL,
  catatan TEXT NOT NULL DEFAULT '',
  guru TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  UNIQUE (semester, kelas, mapel, jenis, nis)
);

CREATE TABLE hafalan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL CHECK (jenis IN ('Setoran', 'Ujian')),
  tanggal TEXT NOT NULL,
  kelas TEXT NOT NULL,
  nis TEXT NOT NULL,
  nama_siswa TEXT NOT NULL,
  surah_nomor INTEGER,
  ayat_awal INTEGER,
  ayat_akhir INTEGER,
  jenis_ujian TEXT,
  fashohah REAL,
  tartil REAL,
  tajwid REAL,
  adab REAL,
  catatan TEXT NOT NULL DEFAULT '',
  guru TEXT NOT NULL
);
