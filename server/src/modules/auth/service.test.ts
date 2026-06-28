import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createAuthService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function makeService() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  return { repo, service: createAuthService({ repo }) };
}

const valid = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

test("register crea usuario verificado y devuelve email", async () => {
  const { repo, service } = await makeService();
  const out = await service.register(valid);
  assert.equal(out.email, "neo@x.io");
  const user = await repo.findUserByEmail(valid.email);
  assert.equal(user!.is_verified, true);
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

test("register nickname duplicado lanza 409 nickname_taken", async () => {
  const { service } = await makeService();
  await service.register(valid);
  await assert.rejects(
    service.register({ ...valid, email: "otro@x.io" }),
    (e: AppError) => e.statusCode === 409 && e.code === "nickname_taken"
  );
});
