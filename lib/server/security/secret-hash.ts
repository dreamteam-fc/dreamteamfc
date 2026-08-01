import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashSecret(plain: string): string {
  const normalized = plain.normalize("NFKC");
  if (normalized.length < 4) {
    throw new Error("La password deve avere almeno 4 caratteri.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  const normalized = plain.normalize("NFKC");
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(normalized, salt, SCRYPT_KEYLEN);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
