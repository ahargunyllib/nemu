import { describe, expect, it } from "vite-plus/test";

import { internalCallerFor } from "./internal-caller";

const SECRET = "a-long-shared-secret-for-the-wa-bot";

function headers(authorization?: string): Headers {
  return new Headers(authorization ? { authorization } : {});
}

describe("internal callers", () => {
  it("recognises the wa-bot by its shared secret", async () => {
    expect(await internalCallerFor(headers(`Bearer ${SECRET}`), { waBot: SECRET })).toBe("wa-bot");
  });

  it("rejects a wrong or missing secret", async () => {
    expect(await internalCallerFor(headers(`Bearer ${SECRET}x`), { waBot: SECRET })).toBeNull();
    expect(await internalCallerFor(headers(SECRET), { waBot: SECRET })).toBeNull();
    expect(await internalCallerFor(headers(), { waBot: SECRET })).toBeNull();
  });

  it("accepts no one while the secret isn't configured", async () => {
    expect(await internalCallerFor(headers("Bearer "), { waBot: "" })).toBeNull();
    expect(await internalCallerFor(headers("Bearer anything"), { waBot: undefined })).toBeNull();
  });
});
