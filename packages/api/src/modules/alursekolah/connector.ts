import { type IntegrationDeps, readSecrets } from "../integrations/service";
import { type AlurSekolahClient, createAlurSekolahClient } from "./client";

/** Hands out a client for a school's AlurSekolah, from its WS-07 base URL and key. */
export type AlurSekolahConnector = (workspaceId: string) => Promise<AlurSekolahClient>;

export class AlurSekolahNotConfiguredError extends Error {
  constructor() {
    super("AlurSekolah belum dihubungkan. Admin Javan mengisi URL API dan kunci API di Integrasi.");
    this.name = "AlurSekolahNotConfiguredError";
  }
}

export function createStoredAlurSekolahConnector(
  deps: IntegrationDeps,
  fetchImpl?: typeof fetch,
): AlurSekolahConnector {
  return async (workspaceId) => {
    const secrets = await readSecrets(deps, workspaceId, [
      "alursekolah_base_url",
      "alursekolah_api_key",
    ]);
    const baseUrl = secrets.alursekolah_base_url;
    const apiKey = secrets.alursekolah_api_key;
    if (!baseUrl || !apiKey) throw new AlurSekolahNotConfiguredError();
    return createAlurSekolahClient({ baseUrl, apiKey, fetch: fetchImpl });
  };
}
