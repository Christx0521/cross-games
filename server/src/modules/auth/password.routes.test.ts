import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createAuthService } from "./service.ts";
import { hashCode } from "../../lib/code.ts";
import { buildApp } from "../../app.ts";

const creds = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

async function appWithVerifiedUser() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  await service.register(creds);
  const user = await repo.findUserByEmail(creds.email);
  // Sembrar un código de reset conocido.
  await repo.insertCode({
    userId: user!.id,
    codeHash: hashCode("7777777", creds.email),
    expiresAt: new Date(Date.now() + 60000),
    purpose: "password_reset",
  });
  return buildApp({ db });
}

test("POST /auth/forgot-password siempre → 200 {sent:true}", async () => {
  const app = await appWithVerifiedUser();
  const res = await app.inject({
    method: "POST", url: "/auth/forgot-password", payload: { email: "ghost@x.io" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sent, true);
  await app.close();
});

test("POST /auth/reset-password con código válido → reset y login con nueva pass", async () => {
  const app = await appWithVerifiedUser();
  const reset = await app.inject({
    method: "POST", url: "/auth/reset-password",
    payload: { email: creds.email, code: "7777777", newPassword: "NewP4ss!9" },
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.json().reset, true);

  const login = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: "NewP4ss!9" },
  });
  assert.equal(login.statusCode, 200);
  await app.close();
});

test("POST /auth/reset-password con código malo → 400 invalid_code", async () => {
  const app = await appWithVerifiedUser();
  const res = await app.inject({
    method: "POST", url: "/auth/reset-password",
    payload: { email: creds.email, code: "0000000", newPassword: "NewP4ss!9" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "invalid_code");
  await app.close();
});
