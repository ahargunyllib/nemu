/**
 * AES-GCM for WS-07 settings (WebCrypto, so it runs in the Worker and in Node tests). The key is
 * SHA-256 of the Worker secret INTEGRATION_SECRETS_KEY. The additional data binds a ciphertext to
 * its workspace and setting name, so a row copied to another setting doesn't decrypt.
 */
export type SealedSecret = { iv: string; ciphertext: string };

export type SecretCipher = {
  seal(plaintext: string, additionalData: string): Promise<SealedSecret>;
  open(sealed: SealedSecret, additionalData: string): Promise<string>;
};

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

export class MissingSecretKeyError extends Error {
  constructor() {
    super("INTEGRATION_SECRETS_KEY is not set; set it to a random value of at least 32 characters");
  }
}

export function createSecretCipher(keyMaterial: string): SecretCipher {
  if (!keyMaterial) {
    const missing = async (): Promise<never> => {
      throw new MissingSecretKeyError();
    };
    return { seal: missing, open: missing };
  }
  let key: Promise<CryptoKey> | undefined;
  const getKey = () => {
    key ??= crypto.subtle
      .digest("SHA-256", encoder.encode(keyMaterial))
      .then((digest) =>
        crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]),
      );
    return key;
  };
  return {
    async seal(plaintext, additionalData) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: encoder.encode(additionalData) },
        await getKey(),
        encoder.encode(plaintext),
      );
      return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
    },
    async open(sealed, additionalData) {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(sealed.iv),
          additionalData: encoder.encode(additionalData),
        },
        await getKey(),
        fromBase64(sealed.ciphertext),
      );
      return new TextDecoder().decode(plaintext);
    },
  };
}
