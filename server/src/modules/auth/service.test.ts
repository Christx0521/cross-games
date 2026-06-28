import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createAuthService } from "./service.ts";
import { hashCode } from "../../lib/code.ts";
import { AppError } from "../../lib/errors.ts";

async function makeService() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  return { repo, service: createAuthService({ repo }) };
}

const valid = { nickname: "neo", email: "neo@x.io", password: "S3cret!", birthYear: 1990 };

test("register crea usuario y devuelve email", async () => {
  const { service } = await makeService();
  const out = await service.register(valid);
  assert.equal(out.email, "neo@x.io");
});

test("register menor de edad lanza 422 underage", async () => {
  const { service } = await makeService();
  await assert.rejects(
    service.register({ ...valid, birthYear: new Date().getUTCFullYear() - 10 }),
    (e: AppError) => e.statusCode === 422 && e.code === "underage"
  );
});

test("register email duplicado lanza 409 email_taken", async () => {
  const { service } = await makeService();
  await service.register(valid);
  await assert.rejects(
    service.register({ ...valid, nickname: "other" }),
    (e: AppError) => e.statusCode === 409 && e.code === "email_taken"
  );
});

test("verifyEmail con código correcto marca verificado", async () => {
  const { repo, service } = await makeService();
  await service.register(valid);
  const user = await repo.findUserByEmail(valid.email);
  await repo.invalidateActiveCodes(user!.id);
  await repo.insertCode({
    userId: user!.id,
    codeHash: hashCode("1234567", valid.email),
    expiresAt: new Date(Date.now() + 60000),
  });
  const out = await service.verifyEmail({ email: valid.email, code: "1234567" });
  assert.deepEqual(out, { verified: true });
  assert.equal((await repo.findUserByEmail(valid.email))!.is_verified, true);
});

test("verifyEmail código incorrecto lanza 400 invalid_code", async () => {
  const { repo, service } = await makeService();
  await service.register(valid);
  const user = await repo.findUserByEmail(valid.email);
  await repo.invalidateActiveCodes(user!.id);
  await repo.insertCode({
    userId: user!.id,
    codeHash: hashCode("1234567", valid.email),
    expiresAt: new Date(Date.now() + 60000),
  });
  await assert.rejects(
    service.verifyEmail({ email: valid.email, code: "0000000" }),
    (e: AppError) => e.statusCode === 400 && e.code === "invalid_code"
  );
});

test("resendCode no lanza para email inexistente", async () => {
  const { service } = await makeService();
  await service.resendCode("nope@x.io");
});
