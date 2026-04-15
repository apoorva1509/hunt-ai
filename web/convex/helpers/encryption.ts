/**
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Master key is read from ENCRYPTION_KEY env var (base64-encoded 32 bytes).
 */

async function getMasterKey(): Promise<CryptoKey> {
  const keyB64 = process.env.ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error("ENCRYPTION_KEY env var not set");
  }
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes, got ${keyBytes.length}`);
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encrypt(
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decrypt(iv: string, ciphertext: string): Promise<string> {
  const key = await getMasterKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) as Uint8Array<ArrayBuffer> },
    key,
    fromBase64(ciphertext) as Uint8Array<ArrayBuffer>
  );
  return new TextDecoder().decode(decrypted);
}
