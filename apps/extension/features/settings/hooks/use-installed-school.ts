import { useCallback, useEffect, useState } from "react";

import {
  installCodeItem,
  type SiteConfig,
  siteConfigItem,
} from "../../../shared/lib/extension-storage";
import { currentSiteConfig } from "../../allowed-sites/api/site-config";
import { installSchool } from "../api/install-school";

type Installed = { installCode: string | null; config: SiteConfig | null };

/** The install code saved in this browser and the school it belongs to, with a way to change it. */
export function useInstalledSchool() {
  const [installed, setInstalled] = useState<Installed | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      const installCode = await installCodeItem.getValue();
      // Refreshes the WS-03 list, so a site the school just added shows up here.
      const config = installCode ? await currentSiteConfig() : await siteConfigItem.getValue();
      if (current) setInstalled({ installCode, config });
    })();
    return () => {
      current = false;
    };
  }, []);

  const save = useCallback(async (code: string) => {
    setPending(true);
    setError(null);
    const result = await installSchool(code);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setInstalled({ installCode: code.trim().toUpperCase(), config: result.config });
  }, []);

  return { installed, pending, error, save };
}
