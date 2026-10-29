/**
 * The one list of nemu_ids, grouped by the Demo App page that renders them.
 *
 * The Demo App, the fixtures, the AI, and the extension's Action Level config
 * (ADR-0002) all target these strings, so never rename or reuse an id. Add a new
 * element's id here before rendering it.
 */
export const NEMU_IDS = {
  /** Login page (`/login`). */
  login: {
    email: "input-login-email",
    password: "input-login-password",
    submit: "button-masuk",
    signInAsRina: "button-masuk-rina",
    signInAsVerifikator: "button-masuk-verifikator",
    signInAsDimas: "button-masuk-dimas",
  },
  /** Header and side menu on every signed-in page. */
  shell: {
    menuBeranda: "menu-beranda",
    menuAjukanPerjalananDinas: "menu-ajukan-perjalanan-dinas",
    menuMyRequest: "menu-my-request",
    menuMyTask: "menu-my-task",
    accountMenu: "button-akun",
    signOut: "menu-item-keluar",
    menuSlaClaims: "menu-klaim-sla",
    menuCrmServices: "menu-crm-layanan",
    menuNocTickets: "menu-tiket-noc",
    menuBilling: "menu-billing",
  },
  /** Favorite Processes on Beranda (`/`): each opens that process's start form. */
  favoriteProcess: {
    perjalananDinas: "favorite-perjalanan-dinas",
    pengajuanCuti: "favorite-pengajuan-cuti",
    reimbursement: "favorite-reimbursement",
  },
  /** Task links, one per Task, on Beranda (`/`) and My Task (`/my-task`). */
  task: {
    pertanggungjawaban: "task-pertanggungjawaban",
    isiRencana: "task-isi-rencana",
    revisi: "task-revisi",
    /** "View all … tasks" under Up next on Beranda; opens My Task. */
    viewAll: "link-lihat-semua-task",
  },
  /** Task detail (`/perdin/task/$instanceId`). */
  taskDetail: {
    back: "link-kembali-my-task",
  },
  /** Ajukan Perjalanan Dinas form (`/perdin/baru`). */
  perdinForm: {
    tabJenisTujuan: "tab-jenis-tujuan",
    tabJadwal: "tab-jadwal",
    tabBiaya: "tab-biaya",
    tabDokumen: "tab-dokumen",
    jenisPerjalanan: "select-jenis-perjalanan",
    /** The surat tugas the trip is based on, picked from the user's surat tugas. */
    dasarPenugasan: "select-dasar-penugasan",
    nomorSuratTugas: "input-nomor-surat-tugas",
    /** Kept from when Kota tujuan was a select; ids are never renamed. */
    kotaTujuan: "select-kota-tujuan",
    maksud: "input-maksud-perjalanan",
    tanggalBerangkat: "input-tanggal-berangkat",
    tanggalKembali: "input-tanggal-kembali",
    modaTransport: "select-moda-transport",
    biayaTransport: "input-biaya-transport",
    lodgingHotel: "opt-penginapan-hotel",
    lodgingNotHotel: "opt-penginapan-tidak-hotel",
    lodgingAmount: "input-nominal-penginapan",
    uangHarian: "input-uang-harian",
    uploadUndangan: "upload-undangan",
    kirim: "button-kirim-pengajuan",
  },
  /** Pertanggungjawaban task (`/perdin/task/$instanceId`). */
  pertanggungjawaban: {
    uploadSuratTugas: "upload-surat-tugas",
    uploadBoardingPassPergi: "upload-boarding-pass-pergi",
    uploadLaporanPerjalanan: "upload-laporan-perjalanan",
    uploadBoardingPassPulang: "upload-boarding-pass-pulang",
    kirim: "button-kirim",
  },
  /** SLA-claim list, tasks, CRM, NOC, and Billing demo pages. */
  slaClaim: {
    taskKlm26100007: "task-klaim-klm-2610-0007",
    taskKlm26100009: "task-klaim-klm-2610-0009",
    taskKlm26100011: "task-klaim-klm-2610-0011",
    letterNumber: "input-nomor-surat-klaim",
    serviceId: "input-service-id-klaim",
    period: "input-periode-klaim",
    receivedAt: "input-tanggal-terima-klaim",
    claimedHours: "input-jam-diklaim",
    uploadLetter: "upload-surat-klaim",
    timelyYes: "opt-klaim-tepat-waktu-ya",
    timelyNo: "opt-klaim-tepat-waktu-tidak",
    crmService: "link-crm-layanan",
    crmContractTab: "tab-kontrak-adendum",
    returnToTask: "link-kembali-task-klaim",
    ticketInc2609014: "row-tiket-inc-2609-014",
    ticketInc2609015: "row-tiket-inc-2609-015",
    ticketInc2609031: "row-tiket-inc-2609-031",
    ticketInc2609047: "row-tiket-inc-2609-047",
    ticketInc2609058: "row-tiket-inc-2609-058",
    requestRcaInc2609058: "button-minta-rca-inc-2609-058",
    compensationAmount: "input-nominal-kompensasi",
    rejectionTemplate: "link-template-penolakan",
    submit: "button-kirim-klaim",
    approve: "button-setujui-klaim",
  },
  /**
   * Demo dock floating at the bottom left of every signed-in page: the demo panel moves a State
   * without the approvers, and a page can add a one-click demo action such as filling its form.
   */
  demoPanel: {
    open: "button-panel-demo",
    close: "button-tutup-panel-demo",
    instance: "select-demo-process-instance",
    advance: "button-majukan-state",
    reset: "button-reset-demo",
    fillForm: "button-isi-formulir-demo",
    advanceSlaClaim: "button-majukan-task-klaim",
  },
} as const;

type Values<T> = T[keyof T];

export type NemuId = Values<{ [Page in keyof typeof NEMU_IDS]: Values<(typeof NEMU_IDS)[Page]> }>;

export const ALL_NEMU_IDS: readonly NemuId[] = Object.values(NEMU_IDS).flatMap((page): NemuId[] =>
  Object.values(page),
);
