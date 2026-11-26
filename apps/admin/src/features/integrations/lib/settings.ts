import type { client } from "@/shared/api/orpc";

export type IntegrationSecretName = Awaited<
  ReturnType<typeof client.listIntegrationSecrets>
>[number]["name"];

export type SettingField = {
  name: IntegrationSecretName;
  label: string;
  description: string;
  inputType: "url" | "password" | "tel";
  placeholder: string;
};

export type SettingGroup = {
  id: "alursekolah" | "moodle" | "whatsapp";
  title: string;
  description: string;
  fields: SettingField[];
};

/** WS-07: what Nemu needs to reach each school system. Every value is stored encrypted. */
export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: "alursekolah",
    title: "AlurSekolah",
    description:
      "API v1 baca-saja untuk membaca nilai, siswa, kelas, dan setoran hafalan. Alamatnya menentukan apakah Nemu membaca tiruan atau tenant asli sekolah.",
    fields: [
      {
        name: "alursekolah_base_url",
        label: "URL API",
        description: "Alamat AlurSekolah sekolah, tanpa /api/v1.",
        inputType: "url",
        placeholder: "https://sekolah.alursekolah.id",
      },
      {
        name: "alursekolah_api_key",
        label: "Kunci API",
        description: "Kunci baca-saja dari AlurSekolah, diawali as_.",
        inputType: "password",
        placeholder: "as_…",
      },
    ],
  },
  {
    id: "moodle",
    title: "Moodle",
    description: "Situs Moodle sekolah dan token layanan web untuk membacanya.",
    fields: [
      {
        name: "moodle_url",
        label: "URL Moodle",
        description: "Alamat situs Moodle sekolah.",
        inputType: "url",
        placeholder: "https://moodle.sekolah.sch.id",
      },
      {
        name: "moodle_token",
        label: "Token",
        description: "Token layanan web Moodle.",
        inputType: "password",
        placeholder: "Token Moodle",
      },
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp Nemu",
    description: "Nomor yang menerima foto buku nilai dari guru.",
    fields: [
      {
        name: "whatsapp_number",
        label: "Nomor WhatsApp Nemu",
        description: "Nomor khusus Nemu, bukan nomor pribadi.",
        inputType: "tel",
        placeholder: "+62 812-0000-0000",
      },
    ],
  },
];
