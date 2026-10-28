import type { NewProcessDocumentRecord, NewProcessInstanceRecord } from "./repository";

// The 3-Momen fixture: Rina's Perjalanan Dinas to Makassar on 3–5 November 2026,
// back home and in Pertanggungjawaban with the boarding pass pulang and the
// laporan perjalanan still missing. It matches @nemu/contracts/fixtures (Momen 3).
// The seed-demo-process-instances migration and the fixes after it insert it (docs/demo-app.md);
// the demo panel's reset restores it.
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
    biayaTransport: 3_500_000,
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
