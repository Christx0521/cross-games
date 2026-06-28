import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "./errors.ts";

test("AppError guarda statusCode y code", () => {
  const e = new AppError(409, "email_taken");
  assert.equal(e.statusCode, 409);
  assert.equal(e.code, "email_taken");
  assert.ok(e instanceof Error);
});
