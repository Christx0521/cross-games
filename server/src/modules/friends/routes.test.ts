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
  const sid = login.cookies.find((c) => c.name === "sid")!;
  return `sid=${sid.value}`;
}

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");
  const bob = await makeUser(app, repo, service, "bob");
  return { app, alice, bob };
}

test("flujo completo: request → requests del destinatario → accept → friends de ambos", async () => {
  const { app, alice, bob } = await setup();

  const req = await app.inject({
    method: "POST", url: "/friends/request",
    headers: { cookie: alice }, payload: { nickname: "bob" },
  });
  assert.equal(req.statusCode, 200);
  assert.equal(req.json().status, "pending");

  const reqs = await app.inject({ method: "GET", url: "/friends/requests", headers: { cookie: bob } });
  assert.equal(reqs.json().length, 1);
  const friendshipId = reqs.json()[0].friendship_id;

  const acc = await app.inject({ method: "POST", url: `/friends/${friendshipId}/accept`, headers: { cookie: bob } });
  assert.equal(acc.statusCode, 200);

  const friendsA = await app.inject({ method: "GET", url: "/friends", headers: { cookie: alice } });
  const friendsB = await app.inject({ method: "GET", url: "/friends", headers: { cookie: bob } });
  assert.equal(friendsA.json()[0].nickname, "bob");
  assert.equal(friendsB.json()[0].nickname, "alice");

  await app.close();
});

test("/friends/request sin sesión → 401", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "POST", url: "/friends/request", payload: { nickname: "bob" } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("reject quita la solicitud de la bandeja", async () => {
  const { app, alice, bob } = await setup();
  await app.inject({ method: "POST", url: "/friends/request", headers: { cookie: alice }, payload: { nickname: "bob" } });
  const reqs = await app.inject({ method: "GET", url: "/friends/requests", headers: { cookie: bob } });
  const id = reqs.json()[0].friendship_id;
  await app.inject({ method: "POST", url: `/friends/${id}/reject`, headers: { cookie: bob } });
  const after = await app.inject({ method: "GET", url: "/friends/requests", headers: { cookie: bob } });
  assert.equal(after.json().length, 0);
  await app.close();
});
