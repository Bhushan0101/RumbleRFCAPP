// Password hashing — PBKDF2-SHA256 to stay compatible with the existing
// Python app's hashes (hashlib.pbkdf2_hmac with 200_000 iterations). This
// lets us migrate the current demo accounts without forcing a password reset.
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 200_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): {
  salt: string;
  hash: string;
} {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return { salt, hash };
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  if (!password || !salt || !expectedHash) return false;
  const computed = pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    ITERATIONS,
    KEYLEN,
    DIGEST,
  );
  const expected = Buffer.from(expectedHash, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}
