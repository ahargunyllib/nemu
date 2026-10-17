import type { NemuRequest, NemuResponse } from "./index.js";

export const momentOneRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/",
  prompt: "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?",
  elements: [
    {
      nemu_id: "menu-ajukan-perjalanan-dinas",
      label: "Ajukan Perjalanan Dinas",
      role: "link",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const momentOneResponse = {
  status: "answer",
  answer: {
    ringkas: "Ini perjalanan dinas luar kota. Saya bukakan formulir pengajuannya.",
    detail:
      "Siapkan surat tugas, rincian jadwal, rencana biaya, dan dokumen pendukung sebelum mengirim pengajuan.",
  },
  citations: [{ doc_id: "sop-pd-01", judul: "SOP-PD-01 Perjalanan Dinas", pasal: "Bagian 2" }],
  calc: [],
  actions: [
    {
      type: "click",
      target: "menu-ajukan-perjalanan-dinas",
      level: "jalan_sendiri",
      label: "Buka formulir",
    },
  ],
  warnings: [],
} satisfies NemuResponse;

export const momentTwoRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/perdin/baru",
  prompt: "Saya menginap di rumah saudara, ini diisi apa?",
  screenshot_crop: "data:image/png;base64,iVBORw0KGgo=",
  elements: [
    {
      nemu_id: "opt-penginapan-tidak-hotel",
      label: "Tidak menginap di hotel",
      role: "radio",
      visible: true,
    },
    {
      nemu_id: "input-nominal-penginapan",
      label: "Nominal penginapan",
      role: "textbox",
      visible: true,
    },
  ],
  process_context: {
    instance_id: "PD-2026-0042",
    active_task: "isi_rencana",
    destination_province: "Sulawesi Selatan",
    nights: 2,
    uploaded_documents: [],
  },
} satisfies NemuRequest;

export const momentTwoResponse = {
  status: "answer",
  answer: {
    ringkas: "Pilih Tidak menginap di hotel. Hak penginapanmu adalah Rp447.000 untuk dua malam.",
    detail: "Perhitungannya 30% x Rp745.000 x 2 malam. Ubah pilihan jika nanti menginap di hotel.",
  },
  citations: [
    {
      doc_id: "pmk-119-2023",
      judul: "PMK 119/2023",
      pasal: "8 ayat (5)",
      halaman: 6,
    },
  ],
  calc: [
    {
      fungsi: "hitung_lumpsum_penginapan",
      input: { tarif: 745_000, malam: 2, persentase: 30 },
      hasil: 447_000,
      sumber: "SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III",
    },
  ],
  actions: [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
      label: "Pilih ini",
    },
  ],
  warnings: ["Ubah isian bila nanti menginap di hotel"],
} satisfies NemuResponse;

export const momentThreeRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/",
  prompt: "Saya sudah pulang kemarin, sekarang apa?",
  elements: [
    {
      nemu_id: "task-pertanggungjawaban",
      label: "Pertanggungjawaban",
      role: "link",
      visible: true,
    },
  ],
  process_context: {
    instance_id: "PD-2026-0042",
    active_task: "Pertanggungjawaban",
    status: "Pertanggungjawaban",
    return_date: "2026-11-05",
    destination_province: "Sulawesi Selatan",
    nights: 2,
    uploaded_documents: ["surat_tugas", "boarding_pass_pergi"],
  },
} satisfies NemuRequest;

export const momentThreeResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Saya bukakan task Pertanggungjawaban. Lengkapi laporan perjalanan dan boarding pass pulang sebelum 12 November 2026.",
    detail: "Batas pertanggungjawaban adalah lima hari kerja setelah tanggal kembali.",
  },
  citations: [{ doc_id: "pmk-113-2012", judul: "PMK 113/2012", pasal: "34" }],
  calc: [
    {
      fungsi: "batas_pertanggungjawaban",
      input: { tanggal_kembali: "2026-11-05", hari_kerja: 5 },
      hasil: "2026-11-12",
    },
  ],
  actions: [
    {
      type: "click",
      target: "task-pertanggungjawaban",
      level: "jalan_sendiri",
      label: "Buka task",
    },
  ],
  warnings: ["Kamu yang menekan Kirim setelah semua dokumen lengkap"],
} satisfies NemuResponse;
