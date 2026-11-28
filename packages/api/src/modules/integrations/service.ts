import {
  type IntegrationSecretName,
  type IntegrationSecretStatus,
  integrationSecretNameSchema,
} from "@nemu/contracts/integrations";

import { normalizeAlurSekolahBaseUrl } from "../alursekolah/client";
import { normalizePhone } from "../school/directory";
import type { SecretCipher } from "./cipher";
import type { IntegrationSecretRepository } from "./repository";

/** WS-07: settings go in encrypted and only their last four characters come back out. */

export type IntegrationDeps = { secrets: IntegrationSecretRepository; cipher: SecretCipher };

export type SaveSecretResult =
  | { status: "ok"; lastFour: string }
  | { status: "invalid"; message: string };

const URL_SETTINGS = new Set<IntegrationSecretName>(["alursekolah_base_url", "moodle_url"]);

function additionalData(workspaceId: string, name: IntegrationSecretName) {
  return `${workspaceId}:${name}`;
}

// URLs lose a trailing slash, phone numbers become 62…, keys are kept as typed.
function normalizeValue(
  name: IntegrationSecretName,
  value: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (URL_SETTINGS.has(name)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return {
        ok: false,
        message: "Alamat harus berupa URL lengkap, mis. https://sekolah.alursekolah.id",
      };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, message: "Alamat harus diawali https://" };
    }
    const withoutSlash = trimmed.replace(/\/+$/u, "");
    return {
      ok: true,
      value:
        name === "alursekolah_base_url" ? normalizeAlurSekolahBaseUrl(withoutSlash) : withoutSlash,
    };
  }
  if (name === "whatsapp_number") {
    const phone = normalizePhone(trimmed);
    if (!/^62\d{8,13}$/u.test(phone)) return { ok: false, message: "Nomor WhatsApp tidak valid" };
    return { ok: true, value: phone };
  }
  if (/\s/u.test(trimmed)) return { ok: false, message: "Kunci tidak boleh berisi spasi" };
  return { ok: true, value: trimmed };
}

/**
 * Each setting's status. An address also shows its host (Website diizinkan's Integrasi card); a key,
 * token or number shows only its last four. A host that can't be decrypted reads as unknown.
 */
export async function listSecrets(
  deps: IntegrationDeps,
  workspaceId: string,
): Promise<IntegrationSecretStatus[]> {
  const records = await deps.secrets.list(workspaceId);
  return Promise.all(
    integrationSecretNameSchema.options.map(async (name) => {
      const record = records.find((item) => item.name === name);
      const host =
        record && URL_SETTINGS.has(name)
          ? await deps.cipher
              .open(record, additionalData(workspaceId, name))
              .then((url) => new URL(url).host)
              .catch(() => null)
          : null;
      return {
        name,
        lastFour: record?.lastFour ?? null,
        host,
        updatedAt: record?.updatedAt ?? null,
      };
    }),
  );
}

export async function saveSecret(
  deps: IntegrationDeps,
  input: { workspaceId: string; updatedBy: string; name: IntegrationSecretName; value: string },
): Promise<SaveSecretResult> {
  const normalized = normalizeValue(input.name, input.value);
  if (!normalized.ok) return { status: "invalid", message: normalized.message };
  const sealed = await deps.cipher.seal(
    normalized.value,
    additionalData(input.workspaceId, input.name),
  );
  const lastFour = normalized.value.slice(-4);
  await deps.secrets.upsert({
    workspaceId: input.workspaceId,
    name: input.name,
    ...sealed,
    lastFour,
    updatedBy: input.updatedBy,
  });
  return { status: "ok", lastFour };
}

/** Server-side only: the decrypted values, for adapters that call the school's systems. */
export async function readSecrets<const N extends IntegrationSecretName>(
  deps: IntegrationDeps,
  workspaceId: string,
  names: readonly N[],
): Promise<Partial<Record<N, string>>> {
  const records = await deps.secrets.find(workspaceId, names);
  const entries = await Promise.all(
    records.map(
      async (record) =>
        [
          record.name,
          await deps.cipher.open(record, additionalData(workspaceId, record.name)),
        ] as const,
    ),
  );
  return Object.fromEntries(entries) as Partial<Record<N, string>>;
}
