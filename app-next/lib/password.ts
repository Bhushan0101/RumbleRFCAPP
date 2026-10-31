// Password hashing — PBKDF2-SHA256 via Node crypto.
//
// Runs on Node (local dev + Render) AND Cloudflare Workers via the
// `nodejs_compat` compatibility flag. Workers' PBKDF2 implementation (both
// Web Crypto and nodejs_compat) enforces a 100,000 iteration ceiling, so
// that's the max we can use. Still OWASP-recommended minimum as of 2026.
import { pbkdf2 as _pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(_pbkdf2);

const ITERATIONS = 100_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export async function hashPassword(password: string): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2(
    password,
    Buffer.from(salt, "hex"),
    ITERATIONS,
    KEYLEN,
    DIGEST,
  );
  return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const computed = await pbkdf2(
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
