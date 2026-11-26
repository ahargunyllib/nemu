import { failureMessage, isInvalidInstallCode } from "../../../shared/api/nemu-service";
import {
  installCodeItem,
  type SiteConfig,
  siteConfigItem,
} from "../../../shared/lib/extension-storage";
import { fetchSiteConfig } from "../../allowed-sites/api/site-config";

export type InstallResult = { ok: true; config: SiteConfig } | { ok: false; message: string };

/** Checks the code with the Nemu Service and keeps it, with the school's WS-03 list, on success. */
export async function installSchool(code: string): Promise<InstallResult> {
  const installCode = code.trim().toUpperCase();
  try {
    const config = await fetchSiteConfig(installCode);
    await Promise.all([installCodeItem.setValue(installCode), siteConfigItem.setValue(config)]);
    return { ok: true, config };
  } catch (error) {
    return {
      ok: false,
      message: isInvalidInstallCode(error)
        ? "Kode pemasangan tidak dikenal. Periksa lagi kode dari Admin Javan."
        : failureMessage(error),
    };
  }
}
