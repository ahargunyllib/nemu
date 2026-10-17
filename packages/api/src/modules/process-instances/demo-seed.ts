import type { NewProcessDocumentRecord, NewProcessInstanceRecord } from "./repository";

// The 3-Momen fixture: Rina (III/a) flies Yogyakarta → Makassar PP on 3–5 November 2026,
// back home and in Pertanggungjawaban with the boarding pass pulang and the
// laporan perjalanan still missing. It matches @nemu/contracts/fixtures (Momen 3).
// Every amount is an SBM 2026 row (data/02_tabel): tiket Yogyakarta–Makassar ekonomi PP,
// lumpsum 30% x Rp745.000 x 2 malam, and uang harian Sulawesi Selatan Rp430.000 x 3 hari.
// The newest reseed-demo-process-instances migration inserts it; the demo panel's reset restores it.
export const DEMO_SEED_INSTANCES: readonly NewProcessInstanceRecord[] = [
  {
    id: "PD-2026-0042",
    ownerId: "rina",
    state: "Pertanggungjawaban",
    jenisPerjalanan: "Perjalanan dinas luar kota",
    nomorSuratTugas: "ST-123/BLD/2026",
    kotaTujuan: "Makassar",
    provinsi: "Sulawesi Selatan",
    maksud: "Rapat koordinasi layanan digital",
    tanggalBerangkat: "2026-11-03",
    tanggalKembali: "2026-11-05",
    modaTransport: "Pesawat",
    biayaTransport: 3_893_000,
    penginapan: "tidak_hotel",
    nominalPenginapan: 447_000,
    uangHarian: 1_290_000,
    dokumenUndangan: "undangan-rapat-koordinasi.pdf",
  },
];

export const DEMO_SEED_DOCUMENTS: readonly NewProcessDocumentRecord[] = [
  { instanceId: "PD-2026-0042", jenis: "surat_tugas", namaFile: "surat-tugas.pdf" },
  {
    instanceId: "PD-2026-0042",
    jenis: "boarding_pass_pergi",
    namaFile: "boarding-pass-pergi-yia-upg.pdf",
  },
];
