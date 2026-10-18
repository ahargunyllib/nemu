import { NEMU_IDS, type NemuId } from "@nemu/contracts/nemu-ids";

/**
 * How far Nemu may act on an element (GLOSSARY.md): Jalan sendiri (Nemu clicks), Arahkan (Nemu
 * highlights, the user fills), Konfirmasi (the user presses), Dilarang (never).
 */
export type ActionLevel = "jalan_sendiri" | "arahkan" | "konfirmasi" | "dilarang";

/**
 * Action Levels per nemu_id, bundled at build time so neither the page nor the Nemu Service can
 * grant click rights (ADR-0002). Only Jalan sendiri elements are ever clicked. An id missing here
 * counts as Arahkan, so a new Demo App element is highlighted, never clicked, until it is listed.
 */
export const ACTION_LEVELS: Partial<Record<NemuId, ActionLevel>> = {
  // Navigation Nemu may open on its own.
  [NEMU_IDS.shell.menuBeranda]: "jalan_sendiri",
  [NEMU_IDS.shell.menuAjukanPerjalananDinas]: "jalan_sendiri",
  [NEMU_IDS.shell.menuMyRequest]: "jalan_sendiri",
  [NEMU_IDS.shell.menuMyTask]: "jalan_sendiri",
  [NEMU_IDS.task.pertanggungjawaban]: "jalan_sendiri",
  [NEMU_IDS.taskDetail.back]: "jalan_sendiri",
  [NEMU_IDS.favoriteProcess.perjalananDinas]: "jalan_sendiri",

  // Buttons that submit something: the user presses them.
  [NEMU_IDS.login.submit]: "konfirmasi",
  [NEMU_IDS.perdinForm.kirim]: "konfirmasi",
  [NEMU_IDS.pertanggungjawaban.kirim]: "konfirmasi",

  // Account actions Nemu never takes.
  [NEMU_IDS.login.signInAsRina]: "dilarang",
  [NEMU_IDS.login.signInAsVerifikator]: "dilarang",
  [NEMU_IDS.shell.accountMenu]: "dilarang",
  [NEMU_IDS.shell.signOut]: "dilarang",
};

const LEVELS_BY_ID: Readonly<Record<string, ActionLevel | undefined>> = ACTION_LEVELS;

export function actionLevelOf(nemuId: string): ActionLevel {
  return (Object.hasOwn(LEVELS_BY_ID, nemuId) && LEVELS_BY_ID[nemuId]) || "arahkan";
}
