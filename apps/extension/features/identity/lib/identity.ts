import type { ExtensionIdentity } from "@nemu/contracts/extension";

/** Who Nemu is helping on this page, or the sentence that says why it can't yet (ID-02). */
export type IdentityResult =
  | ExtensionIdentity
  | { status: "signed_out" | "not_installed" | "error"; message: string };

export const SIGNED_OUT_MESSAGE = "Masuk ke AlurSekolah dulu, supaya Nemu tahu siapa yang memakai.";

export const NOT_INSTALLED_MESSAGE =
  "Nemu belum dipasang untuk sekolah ini. Minta operator sekolah mengisi kode pemasangan di pengaturan Nemu.";
