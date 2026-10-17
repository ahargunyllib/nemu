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
  },
  /** Header and side menu on every signed-in page. */
  shell: {
    menuBeranda: "menu-beranda",
    menuAjukanPerjalananDinas: "menu-ajukan-perjalanan-dinas",
    menuMyRequest: "menu-my-request",
    menuMyTask: "menu-my-task",
    themeMenu: "button-tema",
    themeLight: "menu-item-tema-terang",
    themeDark: "menu-item-tema-gelap",
    themeSystem: "menu-item-tema-sistem",
    accountMenu: "button-akun",
    signOut: "menu-item-keluar",
  },
  /** Task links, one per Task, on Beranda (`/`) and My Task (`/my-task`). */
  task: {
    pertanggungjawaban: "task-pertanggungjawaban",
  },
  /** Task detail (`/perdin/task/$instanceId`). */
  taskDetail: {
    back: "link-kembali-my-task",
  },
  /** Ajukan Perjalanan Dinas form (`/perdin/baru`), rendered from #3. */
  perdinForm: {
    lodgingNotHotel: "opt-penginapan-tidak-hotel",
    lodgingAmount: "input-nominal-penginapan",
  },
  /** Pertanggungjawaban task (`/perdin/task/$instanceId`), rendered from #4. */
  pertanggungjawaban: {
    uploadLaporanPerjalanan: "upload-laporan-perjalanan",
    uploadBoardingPassPulang: "upload-boarding-pass-pulang",
    kirim: "button-kirim",
  },
} as const;

type Values<T> = T[keyof T];

export type NemuId = Values<{ [Page in keyof typeof NEMU_IDS]: Values<(typeof NEMU_IDS)[Page]> }>;

export const ALL_NEMU_IDS: readonly NemuId[] = Object.values(NEMU_IDS).flatMap((page): NemuId[] =>
  Object.values(page),
);
