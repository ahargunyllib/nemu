/**
 * Services the team runs outside Cloudflare that call the Nemu Service without a user session.
 * Each proves itself with a shared secret in `Authorization: Bearer <secret>`.
 */
export type InternalCaller = "wa-bot";

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** Compares digests of equal length so the time taken doesn't reveal how much of the secret matched. */
async function sameSecret(presented: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(presented), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

/**
 * Which internal service sent this request, or null. An empty configured secret accepts no one, so a
 * deploy without `WA_BOT_SECRET` keeps the wa-bot endpoints closed.
 */
export async function internalCallerFor(
  headers: Headers,
  secrets: { waBot: string | undefined },
): Promise<InternalCaller | null> {
  const presented = headers.get("authorization")?.match(/^Bearer (.+)$/u)?.[1];
  if (!presented || !secrets.waBot) return null;
  return (await sameSecret(presented, secrets.waBot)) ? "wa-bot" : null;
}
