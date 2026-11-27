import type { ProcessGraph } from "../bpmn/graph.js";

/**
 * The F3-11 symptom index for the official F2-1 SPP BPMN (`F2-1_alur-spp.bpmn`, labels in
 * English, no documentation), as the live text model writes it on upload. The offline runtime
 * answers with it so `NEMU_RESPONDER=fixture` and the Playwright `verify:f2-08` run on the official
 * file without a key; the rest of the pipeline is the real code.
 */
const FINANCE = "bagian keuangan";

export const F2_1_SPP_INDEX: Record<
  string,
  { symptoms: string[]; way_back: string | null; role: string | null }
> = {
  Start_InvoiceIssued: {
    symptoms: ["tagihan SPP terbit untuk orang tua"],
    way_back: null,
    role: FINANCE,
  },
  Task_PayInvoice: {
    symptoms: ["orang tua perlu membayar tagihan"],
    way_back: null,
    role: FINANCE,
  },
  Timer_DueDateReached: {
    symptoms: ["tagihan sudah lewat jatuh tempo"],
    way_back: null,
    role: FINANCE,
  },
  Boundary_PaidInCash: {
    symptoms: ["orang tua bayar tunai di sekolah"],
    way_back: null,
    role: FINANCE,
  },
  Catch_PaymentSent: {
    symptoms: ["orang tua bayar lewat VA atau QRIS"],
    way_back: null,
    role: FINANCE,
  },
  Task_LockGrades: {
    symptoms: [
      "nilai tidak muncul di aplikasi orang tua",
      "nilai murid terkunci setelah jatuh tempo",
    ],
    way_back: "Task_UnlockGrades",
    role: FINANCE,
  },
  End_GradesLocked: { symptoms: [], way_back: "Task_UnlockGrades", role: FINANCE },
  End_NotRegularInvoice: { symptoms: [], way_back: null, role: null },
  Task_CheckInvoices: { symptoms: [], way_back: null, role: FINANCE },
  Task_UpdatePartiallyPaid: {
    symptoms: ["nilai masih terkunci walau orang tua sudah bayar sebagian"],
    way_back: "Task_UnlockGrades",
    role: FINANCE,
  },
  End_InvoicesPartiallyPaid: {
    symptoms: ["status tagihan sebagian dibayar"],
    way_back: "Task_UnlockGrades",
    role: FINANCE,
  },
  Task_UnlockGrades: { symptoms: ["nilai terbuka lagi"], way_back: null, role: FINANCE },
  Task_UpdateFullyPaid: { symptoms: ["tagihan tercatat lunas"], way_back: null, role: FINANCE },
  End_InvoicePaid: { symptoms: [], way_back: null, role: null },
  Task_CreditESaku: { symptoms: ["saldo E-Saku bertambah"], way_back: null, role: FINANCE },
};

/** Whether the graph is the official F2-1 SPP file (its process id and every indexed element). */
export function isF21Spp(graph: ProcessGraph): boolean {
  return graph.id === "Process_SPP" && Object.keys(F2_1_SPP_INDEX).every((id) => id in graph.nodes);
}

/**
 * The plain-language phrasing for the three F2-1 walks, by the cause's name, written from the
 * official key (`jawaban_inti` and `balasan_untuk_orang_tua`) so the offline answers read like the
 * live model's. Steps follow the walk's order; the code still decides the ids, the fixer and the
 * guardrails.
 */
export const F2_1_SPP_PHRASING: Record<
  string,
  { answer: string; why: string; steps: string[]; parent_reply: string }
> = {
  "Lock Student Grades": {
    answer:
      "Menurut alur SPP sekolah, nilai murid dikunci otomatis kalau ada tagihan SPP bulanan (tagihan reguler) yang sudah lewat jatuh tempo.",
    why: "Saat tagihan reguler lewat jatuh tempo, sistem mengunci nilai murid. Jalan kembalinya: nilai dibuka lagi setelah tidak ada lagi tagihan reguler yang lewat jatuh tempo.",
    steps: [
      "Tagihan sampai di tanggal jatuh tempo.",
      "Sistem memeriksa: ini tagihan reguler (bulanan).",
      "Nilai murid dikunci, jadi tidak muncul di aplikasi orang tua.",
      "Nilai dibuka lagi kalau tidak ada lagi tagihan reguler yang lewat jatuh tempo.",
    ],
    parent_reply:
      "Assalamu'alaikum, Bapak/Ibu. Nilai UTS ananda sudah kami masukkan. Saat ini nilainya belum tampil di aplikasi karena masih ada administrasi sekolah yang perlu diselesaikan. Untuk rinciannya, Bapak/Ibu bisa menghubungi Bu Ratna di bagian keuangan. Setelah selesai, nilai akan terbuka otomatis. Terima kasih.",
  },
  "Update Status: Partially Paid": {
    answer:
      'Menurut alur sekolah, pembayaran sebagian belum membuka nilai: kalau masih ada tagihan reguler yang lewat jatuh tempo, statusnya jadi "sebagian dibayar" dan nilai tetap terkunci. Nilai baru terbuka kalau tidak ada lagi tagihan reguler yang lewat jatuh tempo.',
    why: 'Setelah pembayaran masuk, sistem memeriksa tagihan. Masih ada tagihan reguler yang lewat jatuh tempo, jadi status menjadi "sebagian dibayar". Jalan kembalinya: nilai dibuka kalau tidak ada lagi yang lewat jatuh tempo.',
    steps: [
      "Setelah pembayaran masuk, sistem memeriksa tagihan.",
      "Masih ada tagihan reguler yang lewat jatuh tempo.",
      'Status tagihan menjadi "sebagian dibayar", nilai tetap terkunci.',
      "Pembanding: kalau tidak ada lagi tagihan reguler yang lewat jatuh tempo, nilai dibuka.",
    ],
    parent_reply:
      "Terima kasih informasinya, Bapak/Ibu. Nilai ananda akan terbuka otomatis setelah administrasi semester ini selesai seluruhnya. Untuk mengecek apa yang masih perlu diselesaikan, Bapak/Ibu bisa menghubungi Bu Ratna di bagian keuangan. Terima kasih.",
  },
  "Unlock Student Grades": {
    answer:
      "Menurut alur sekolah, setelah pembayaran tunai dicatat, sistem langsung memeriksa tagihan. Kalau tidak ada lagi tagihan reguler yang lewat jatuh tempo, nilai terbuka otomatis saat itu juga; kalau masih ada, nilai tetap terkunci.",
    why: "Pembayaran tunai dicatat, tagihan diperiksa, dan nilai dibuka kalau tidak ada lagi tagihan reguler yang lewat jatuh tempo.",
    steps: [
      "Orang tua membayar tunai di sekolah dan pembayarannya dicatat.",
      "Sistem memeriksa tagihan.",
      "Tidak ada lagi tagihan reguler yang lewat jatuh tempo.",
      "Nilai dibuka otomatis dan tagihan tercatat lunas.",
    ],
    parent_reply:
      "Bapak/Ibu bisa membayar tunai di bagian keuangan sekolah (Bu Ratna). Setelah pembayaran dicatat dan administrasinya selesai, nilai ananda akan terbuka otomatis di aplikasi. Terima kasih.",
  },
};
