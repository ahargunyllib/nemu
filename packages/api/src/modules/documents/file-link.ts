/**
 * Short-lived signed links to a knowledge document's file (#258). The Nemu Extension proves who
 * is asking with headers (ADR-0015), and a tab opened on a link sends none, so the teacher's right
 * to read the document is checked when the link is made and carried in its token: the school, the
 * document and an expiry, signed with HMAC-SHA256 (WebCrypto, so it runs in the Worker and in
 * Node tests).
 */
export type DocumentLinkClaims = { workspaceId: string; documentId: string; expiresAt: number };

export type DocumentLinkSigner = {
  /** A token for `claims`, opaque to whoever holds it. */
  sign(claims: DocumentLinkClaims): Promise<string>;
  /** The token's claims, or why it can't be used. */
  verify(token: string): Promise<DocumentLinkClaims | "invalid" | "expired">;
  now(): number;
};

const encoder = new TextEncoder();
// Keeps these signatures apart from anything else signed with the same Worker secret.
const PURPOSE = "nemu/document-link/v1";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(text)) return null;
  try {
    return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
      char.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function parseClaims(bytes: Uint8Array): DocumentLinkClaims | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(value) || value.length !== 3) return null;
    const [workspaceId, documentId, expiresAt] = value;
    return typeof workspaceId === "string" &&
      typeof documentId === "string" &&
      Number.isInteger(expiresAt)
      ? { workspaceId, documentId, expiresAt }
      : null;
  } catch {
    return null;
  }
}

export class MissingDocumentLinkSecretError extends Error {
  constructor() {
    super("BETTER_AUTH_SECRET is not set, so document links can't be signed");
  }
}

/** `secret` is a Worker secret; `now` is the clock, moved by tests. */
export function createDocumentLinkSigner(
  secret: string,
  now: () => number = Date.now,
): DocumentLinkSigner {
  let key: Promise<CryptoKey> | undefined;
  const getKey = () => {
    if (!secret) throw new MissingDocumentLinkSecretError();
    key ??= crypto.subtle.importKey(
      "raw",
      encoder.encode(`${PURPOSE}\0${secret}`),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    return key;
  };

  return {
    now,
    async sign({ workspaceId, documentId, expiresAt }) {
      const payload = encoder.encode(JSON.stringify([workspaceId, documentId, expiresAt]));
      const signature = await crypto.subtle.sign("HMAC", await getKey(), payload);
      return `${toBase64Url(payload)}.${toBase64Url(new Uint8Array(signature))}`;
    },
    async verify(token) {
      const [payloadPart, signaturePart, ...rest] = token.split(".");
      if (payloadPart === undefined || signaturePart === undefined || rest.length > 0) {
        return "invalid";
      }
      const payload = fromBase64Url(payloadPart);
      const signature = fromBase64Url(signaturePart);
      if (!payload || !signature) return "invalid";
      if (!(await crypto.subtle.verify("HMAC", await getKey(), signature, payload))) {
        return "invalid";
      }
      const claims = parseClaims(payload);
      if (!claims) return "invalid";
      return claims.expiresAt <= now() ? "expired" : claims;
    },
  };
}
