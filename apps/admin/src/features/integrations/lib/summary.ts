import type { IntegrationSecretName, IntegrationSecretStatus } from "@nemu/contracts/integrations";

export type IntegrationSummaryRow = {
  label: string;
  /** Null when the integration isn't set up yet ("Belum diisi"). */
  value: string | null;
};

const MASK = "••••";

/**
 * The Integrasi card on Website diizinkan (F3-15): one line per school system. Keys and tokens are
 * always masked; an address shows its host, the WhatsApp number only its last four digits.
 */
export function integrationSummaryRows(
  secrets: readonly Pick<IntegrationSecretStatus, "name" | "lastFour" | "host">[],
): IntegrationSummaryRow[] {
  const find = (name: IntegrationSecretName) => secrets.find((secret) => secret.name === name);
  const isSet = (name: IntegrationSecretName) => Boolean(find(name)?.lastFour);

  const moodleUrl = find("moodle_url");
  const moodleHost = moodleUrl?.lastFour ? (moodleUrl.host ?? "alamat terpasang") : null;
  const moodleToken = isSet("moodle_token") ? `token ${MASK}` : "token belum diisi";
  const whatsapp = find("whatsapp_number")?.lastFour;

  return [
    {
      label: "Kunci API AlurSekolah",
      // API v1 is read-only: grades, students, classes and hafalan deposits (WS-07).
      value: isSet("alursekolah_api_key")
        ? `${MASK} · Baca saja · nilai, murid, kelas, hafalan`
        : null,
    },
    {
      label: "Moodle",
      value: moodleHost ? `${moodleHost} · ${moodleToken}` : null,
    },
    {
      label: "Nomor WA Nemu",
      value: whatsapp ? `+62 8xx…${whatsapp} · nomor khusus Nemu` : null,
    },
  ];
}
