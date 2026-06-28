import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEnv } from "./env.ts";

test("loadEnv parsea y castea PORT a número", () => {
  const env = loadEnv({
    PORT: "3000",
    WEB_ORIGIN: "http://localhost:5173",
    DATABASE_PATH: "./.pgdata",
    CODE_SECRET: "secret",
    EMAIL_FROM: "x@y.z",
  });
  assert.equal(env.PORT, 3000);
  assert.equal(env.RESEND_API_KEY, "");
});

test("loadEnv falla si falta CODE_SECRET", () => {
  assert.throws(() => loadEnv({ PORT: "3000" } as Record<string, string>));
});
