import { type AllowedSite, hostPermissionFor } from "@nemu/contracts/extension";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";

/**
 * Which WS-03 sites the browser already lets Nemu reach. A site the school added after install
 * needs the operator to grant it here (`optional_host_permissions`, ADR-0016); Chrome asks only
 * from a click on an extension page.
 */
export function useSitePermissions(sites: readonly AllowedSite[]) {
  const [granted, setGranted] = useState<ReadonlySet<string>>(new Set());

  const refresh = useCallback(async () => {
    const checks = await Promise.all(
      sites.map(async (site) => {
        const origins = [hostPermissionFor(site.pattern)];
        return (await browser.permissions.contains({ origins })) ? site.pattern : null;
      }),
    );
    setGranted(new Set(checks.filter((pattern) => pattern !== null)));
  }, [sites]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grant = useCallback(
    async (site: AllowedSite) => {
      await browser.permissions.request({ origins: [hostPermissionFor(site.pattern)] });
      await refresh();
    },
    [refresh],
  );

  return { granted, grant };
}
