import { describe, expect, test } from "vite-plus/test";

import { integrationSummaryRows } from "./summary";

const unset = (
  name:
    | "alursekolah_base_url"
    | "alursekolah_api_key"
    | "moodle_url"
    | "moodle_token"
    | "whatsapp_number",
) => ({ name, lastFour: null, host: null });

describe("Integrasi summary on Website diizinkan", () => {
  test("masks the key and token, shows Moodle's host and the number's last four", () => {
    const rows = integrationSummaryRows([
      { name: "alursekolah_base_url", lastFour: "3003", host: "localhost:3003" },
      { name: "alursekolah_api_key", lastFour: "9f3a", host: null },
      { name: "moodle_url", lastFour: "test", host: "moodle-uji.tim-nemu.test" },
      { name: "moodle_token", lastFour: "7c21", host: null },
      { name: "whatsapp_number", lastFour: "1999", host: null },
    ]);

    expect(rows).toEqual([
      {
        label: "Kunci API AlurSekolah",
        value: "•••• · Baca saja · nilai, murid, kelas, hafalan",
      },
      { label: "Moodle", value: "moodle-uji.tim-nemu.test · token ••••" },
      { label: "Nomor WA Nemu", value: "+62 8xx…1999 · nomor khusus Nemu" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/9f3a|7c21/u);
  });

  test("says Belum diisi (null) for what Admin Javan hasn't set", () => {
    const rows = integrationSummaryRows([
      unset("alursekolah_base_url"),
      unset("alursekolah_api_key"),
      { name: "moodle_url", lastFour: "test", host: null },
      unset("moodle_token"),
      unset("whatsapp_number"),
    ]);

    expect(rows.map((row) => row.value)).toEqual([
      null,
      "alamat terpasang · token belum diisi",
      null,
    ]);
  });
});
