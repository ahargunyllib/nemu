import { integrationSecret } from "@nemu/db/schema/integrations";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import {
  FAKE_ALURSEKOLAH_KEY,
  FAKE_ALURSEKOLAH_URL,
  createFakeAlurSekolah,
} from "../../testing/alursekolah";
import { createSchoolContext } from "../../testing/school";
import { createSecretCipher } from "./cipher";
import { integrationsRouter } from "./router";

const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };
const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };

describe("WS-07 integration secrets", () => {
  it("stores a key encrypted and only ever shows its last four characters", async () => {
    const context = await createSchoolContext(ADMIN_JAVAN);

    const saved = await call(
      integrationsRouter.saveIntegrationSecret,
      { name: "alursekolah_api_key", value: "  contoh-kunci-rahasia-abcd  " },
      { context },
    );
    expect(saved).toEqual({ lastFour: "abcd" });

    const list = await call(integrationsRouter.listIntegrationSecrets, undefined, { context });
    expect(list.map(({ name, lastFour }) => [name, lastFour])).toEqual([
      ["alursekolah_base_url", null],
      ["alursekolah_api_key", "abcd"],
      ["moodle_url", null],
      ["moodle_token", null],
      ["whatsapp_number", null],
    ]);
    expect(JSON.stringify(list)).not.toContain("rahasia");

    const [row] = await context.db.select().from(integrationSecret);
    expect(row).toMatchObject({ workspaceId: "W-SEKOLAH", updatedBy: "javan", lastFour: "abcd" });
    expect(JSON.stringify(row)).not.toContain("rahasia");
  });

  it("replaces a value on Ganti and normalises URLs and the WhatsApp number", async () => {
    const context = await createSchoolContext(ADMIN_JAVAN);
    const save = (name: "moodle_url" | "whatsapp_number", value: string) =>
      call(integrationsRouter.saveIntegrationSecret, { name, value }, { context });

    await save("moodle_url", "https://moodle.lama.test/");
    expect(await save("moodle_url", "https://moodle.sekolah.test/")).toEqual({ lastFour: "test" });
    expect(await save("whatsapp_number", "0812-0000-1999")).toEqual({ lastFour: "1999" });
    expect(await context.db.select().from(integrationSecret)).toHaveLength(2);

    await expect(save("moodle_url", "moodle.sekolah.test")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(save("whatsapp_number", "12")).rejects.toMatchObject({
      message: "Nomor WhatsApp tidak valid",
    });
  });

  it("says so when the Nemu Service has no INTEGRATION_SECRETS_KEY", async () => {
    const context = await createSchoolContext(ADMIN_JAVAN);
    context.secretCipher = createSecretCipher("");
    await expect(
      call(
        integrationsRouter.saveIntegrationSecret,
        { name: "alursekolah_api_key", value: "as_x" },
        { context },
      ),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/INTEGRATION_SECRETS_KEY/u),
    });
  });

  it("shows a school operator the masked list; only Admin Javan enters or checks keys (ADR-0022)", async () => {
    const admin = await createSchoolContext(ADMIN_JAVAN);
    await call(
      integrationsRouter.saveIntegrationSecret,
      { name: "alursekolah_api_key", value: "as_kunci-rahasia-wxyz" },
      { context: admin },
    );

    // The operator reads the same database: "set or not" and the last four, never the value.
    const operator = { ...admin, session: (await createSchoolContext(OPERATOR)).session };
    const list = await call(integrationsRouter.listIntegrationSecrets, undefined, {
      context: operator,
    });
    expect(list.find((secret) => secret.name === "alursekolah_api_key")?.lastFour).toBe("wxyz");
    expect(JSON.stringify(list)).not.toContain("rahasia");

    await expect(
      call(
        integrationsRouter.saveIntegrationSecret,
        { name: "alursekolah_api_key", value: "as_x" },
        { context: operator },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(integrationsRouter.checkAlurSekolahConnection, undefined, { context: operator }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps WS-07 from a teacher", async () => {
    const context = await createSchoolContext();
    await expect(
      call(integrationsRouter.listIntegrationSecrets, undefined, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(
        integrationsRouter.saveIntegrationSecret,
        { name: "alursekolah_api_key", value: "as_x" },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("checks the AlurSekolah connection with the stored URL and key", async () => {
    const fake = createFakeAlurSekolah({
      siswa: [{ nis: "1001", nama: "Adi", kelas: "4B" }],
      nilai: [
        {
          id: 1,
          nis: "1001",
          nama_siswa: "Adi",
          kelas: "4B",
          semester: "2026/2027 Ganjil",
          mapel: "Matematika",
          jenis: "UTS",
          skor: 80,
          tanggal: "2026-11-20",
        },
      ],
    });
    const context = await createSchoolContext(ADMIN_JAVAN, undefined, fake);
    const check = () => call(integrationsRouter.checkAlurSekolahConnection, undefined, { context });
    const save = (name: "alursekolah_base_url" | "alursekolah_api_key", value: string) =>
      call(integrationsRouter.saveIntegrationSecret, { name, value }, { context });

    expect(await check()).toMatchObject({
      status: "failed",
      message: expect.stringMatching(/belum dihubungkan/u),
    });
    expect(fake.requests).toHaveLength(0);

    expect(await save("alursekolah_base_url", `${FAKE_ALURSEKOLAH_URL}/api/v1/`)).toEqual({
      lastFour: FAKE_ALURSEKOLAH_URL.slice(-4),
    });
    await save("alursekolah_api_key", "as_kunci_salah");
    const refused = await check();
    expect(refused).toMatchObject({
      status: "failed",
      message: expect.stringMatching(/HTTP 401/u),
    });
    expect(JSON.stringify(refused)).not.toContain("as_kunci_salah");

    await save("alursekolah_api_key", FAKE_ALURSEKOLAH_KEY);
    expect(await check()).toEqual({
      status: "ok",
      account: "Rizal Pratama",
      email: "rizal.operator@sditnusantara.sch.id",
      classes: ["4B"],
      grades: 1,
    });
  });
});
