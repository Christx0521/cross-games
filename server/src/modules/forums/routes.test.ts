import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createAuthService } from "../auth/service.ts";
import { hashCode } from "../../lib/code.ts";
import { buildApp } from "../../app.ts";
import type { FastifyInstance } from "fastify";

async function makeUser(app: FastifyInstance, repo: ReturnType<typeof createAuthRepo>, service: ReturnType<typeof createAuthService>, nickname: string) {
  const email = `${nickname}@x.io`;
  await service.register({ nickname, email, password: "S3cret!1", birthYear: 1990 });
  const user = await repo.findUserByEmail(email);
  await repo.invalidateActiveCodes(user!.id);
  await repo.insertCode({ userId: user!.id, codeHash: hashCode("1234567", email), expiresAt: new Date(Date.now() + 60000) });
  await service.verifyEmail({ email, code: "1234567" });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { identifier: nickname, password: "S3cret!1" } });
  return `sid=${login.cookies.find((c) => c.name === "sid")!.value}`;
}

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");
  return { app, alice };
}

test("crear foro requiere sesión: sin cookie → 401", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "POST", url: "/forums", payload: { name: "X", languageCode: "es", continent: "NA" } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("GET /forums es público y filtra por país", async () => {
  const { app, alice } = await setup();
  await app.inject({ method: "POST", url: "/forums", headers: { cookie: alice }, payload: { name: "PA", languageCode: "es", continent: "NA", countryCode: "PA" } });
  await app.inject({ method: "POST", url: "/forums", headers: { cookie: alice }, payload: { name: "ES", languageCode: "es", continent: "EU", countryCode: "ES" } });

  const all = await app.inject({ method: "GET", url: "/forums" }); // sin cookie
  assert.equal(all.statusCode, 200);
  assert.equal(all.json().length, 2);

  const pa = await app.inject({ method: "GET", url: "/forums?country=PA" });
  assert.equal(pa.json().length, 1);
  assert.equal(pa.json()[0].country_code, "PA");
  await app.close();
});

test("GET /forums/:id/messages es público (lectura sin sesión)", async () => {
  const { app, alice } = await setup();
  const forum = await app.inject({ method: "POST", url: "/forums", headers: { cookie: alice }, payload: { name: "G", languageCode: "es", continent: "NA" } });
  const id = forum.json().id;
  const res = await app.inject({ method: "GET", url: `/forums/${id}/messages` }); // sin cookie
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().messages, []);
  await app.close();
});
