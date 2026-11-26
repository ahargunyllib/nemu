import { describe, expect, it } from "vite-plus/test";

import { createSecretCipher } from "./cipher";

const KEY = "test-integration-secrets-key-0123456789";

describe("integration secret cipher", () => {
  it("opens what it sealed, without the plaintext in the stored value", async () => {
    const cipher = createSecretCipher(KEY);
    const sealed = await cipher.seal("as_kunci_rahasia", "W-SEKOLAH:alursekolah_api_key");

    expect(JSON.stringify(sealed)).not.toContain("kunci_rahasia");
    await expect(cipher.open(sealed, "W-SEKOLAH:alursekolah_api_key")).resolves.toBe(
      "as_kunci_rahasia",
    );
  });

  it("refuses a value moved to another setting or opened with another key", async () => {
    const sealed = await createSecretCipher(KEY).seal("as_kunci", "W-SEKOLAH:alursekolah_api_key");

    await expect(createSecretCipher(KEY).open(sealed, "W-SEKOLAH:moodle_token")).rejects.toThrow();
    await expect(
      createSecretCipher(`${KEY}-other`).open(sealed, "W-SEKOLAH:alursekolah_api_key"),
    ).rejects.toThrow();
  });

  it("fails clearly when the Worker secret is missing", async () => {
    await expect(createSecretCipher("").seal("x", "y")).rejects.toThrow("INTEGRATION_SECRETS_KEY");
  });
});
