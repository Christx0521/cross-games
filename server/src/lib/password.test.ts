import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

test("hashPassword produce argon2id verificable", async () => {
  const hash = await hashPassword("S3cret!");
  assert.ok(hash.startsWith("$argon2id$"));
  assert.equal(await verifyPassword(hash, "S3cret!"), true);
  assert.equal(await verifyPassword(hash, "wrong"), false);
});
