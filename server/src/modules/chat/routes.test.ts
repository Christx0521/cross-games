import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createAuthService } from "../auth/service.ts";
import { buildApp } from "../../app.ts";
import type { FastifyInstance } from "fastify";

async function makeUser(app: FastifyInstance, repo: ReturnType<typeof createAuthRepo>, service: ReturnType<typeof createAuthService>, nickname: string) {
  const email = `${nickname}@x.io`;
  await service.register({ nickname, email, password: "S3cret!1", birthYear: 1990 });
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
  const bob = await makeUser(app, repo, service, "bob");
  const carol = await makeUser(app, repo, service, "carol");
  return { app, alice, bob, carol };
}

test("POST /conversations/dm crea (o reusa) la conversación", async () => {
  const { app, alice } = await setup();
  const r1 = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: alice }, payload: { nickname: "bob" } });
  assert.equal(r1.statusCode, 200);
  const r2 = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: alice }, payload: { nickname: "bob" } });
  assert.equal(r1.json().conversationId, r2.json().conversationId);
  await app.close();
});

test("GET messages de un no-miembro → 403", async () => {
  const { app, alice, carol } = await setup();
  const dm = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: alice }, payload: { nickname: "bob" } });
  const id = dm.json().conversationId;
  const res = await app.inject({ method: "GET", url: `/conversations/${id}/messages`, headers: { cookie: carol } });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("GET messages sin sesión → 401", async () => {
  const { app, alice } = await setup();
  const dm = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: alice }, payload: { nickname: "bob" } });
  const res = await app.inject({ method: "GET", url: `/conversations/${dm.json().conversationId}/messages` });
  assert.equal(res.statusCode, 401);
  await app.close();
});
