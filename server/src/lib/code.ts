import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.ts";

export const CODE_TTL_MS = 15 * 60 * 1000;

export function generateCode(): string {
  return String(randomInt(0, 10_000_000)).padStart(7, "0");
}

export function hashCode(code: string, email: string): string {
  return createHmac("sha256", env.CODE_SECRET)
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

export function verifyCode(code: string, email: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashCode(code, email), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
