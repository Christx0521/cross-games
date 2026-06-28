import { test } from "node:test";
import assert from "node:assert/strict";
import { sendVerificationCode } from "./email.ts";

test("sendVerificationCode en dev imprime el código y no lanza", async () => {
  const logs: string[] = [];
  const original = console.log;
  console.log = (msg?: unknown) => logs.push(String(msg));
  try {
    await sendVerificationCode("a@b.c", "1234567");
  } finally {
    console.log = original;
  }
  assert.ok(logs.some((l) => l.includes("a@b.c") && l.includes("1234567")));
});
