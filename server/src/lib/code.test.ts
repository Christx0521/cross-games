import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCode, hashCode, verifyCode, CODE_TTL_MS } from "./code.ts";

test("generateCode da 7 dígitos", () => {
  const c = generateCode();
  assert.match(c, /^\d{7}$/);
});

test("verifyCode acepta el código correcto y rechaza el incorrecto", () => {
  const code = "1234567";
  const email = "a@b.c";
  const hash = hashCode(code, email);
  assert.equal(verifyCode(code, email, hash), true);
  assert.equal(verifyCode("7654321", email, hash), false);
  assert.equal(verifyCode(code, "other@b.c", hash), false);
});

test("CODE_TTL_MS es 15 minutos", () => {
  assert.equal(CODE_TTL_MS, 15 * 60 * 1000);
});
