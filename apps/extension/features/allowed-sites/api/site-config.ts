import { createNemuServiceClient, isInvalidInstallCode } from "../../../shared/api/nemu-service";
import {
  installCodeItem,
  type SiteConfig,
  siteConfigItem,
} from "../../../shared/lib/extension-storage";

/** How long a WS-03 list is trusted before it is read again, so a change needs no update. */
const MAX_AGE_MS = 60_000;

/** Reads the school and its WS-03 list for an install code; the settings page saves it with this. */
export async function fetchSiteConfig(installCode: string): Promise<SiteConfig> {
  const config = await createNemuServiceClient({ installCode }).extensionConfig();
  return { ...config, fetchedAt: Date.now() };
}

/**
 * The installed school's WS-03 list, refreshed once a minute. Null without an install code or
 * once the Nemu Service rejects it; the last list stands in while the service can't be reached.
 */
export async function currentSiteConfig(): Promise<SiteConfig | null> {
  const [installCode, cached] = await Promise.all([
    installCodeItem.getValue(),
    siteConfigItem.getValue(),
  ]);
  if (!installCode) return null;
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached;
  try {
    const fresh = await fetchSiteConfig(installCode);
    await siteConfigItem.setValue(fresh);
    return fresh;
  } catch (error) {
    if (!isInvalidInstallCode(error)) return cached;
    await siteConfigItem.setValue(null);
    return null;
  }
}
