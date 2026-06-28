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
  const admin = await makeUser(app, repo, service, "admin1");
  const bob = await makeUser(app, repo, service, "bob");
  return { app, admin, bob };
}

test("crear grupo, agregar a bob, y bob lo ve listado", async () => {
  const { app, admin, bob } = await setup();
  const create = await app.inject({ method: "POST", url: "/groups", headers: { cookie: admin }, payload: { name: "Squad" } });
  assert.equal(create.statusCode, 201);
  const id = create.json().id;

  const add = await app.inject({ method: "POST", url: `/groups/${id}/members`, headers: { cookie: admin }, payload: { nickname: "bob" } });
  assert.equal(add.statusCode, 200);

  const groupsBob = await app.inject({ method: "GET", url: "/groups", headers: { cookie: bob } });
  assert.equal(groupsBob.json().length, 1);
  assert.equal(groupsBob.json()[0].name, "Squad");
  await app.close();
});

test("un miembro no-admin no puede agregar → 403", async () => {
  const { app, admin, bob } = await setup();
  const id = (await app.inject({ method: "POST", url: "/groups", headers: { cookie: admin }, payload: { name: "Squad" } })).json().id;
  await app.inject({ method: "POST", url: `/groups/${id}/members`, headers: { cookie: admin }, payload: { nickname: "bob" } });
  const res = await app.inject({ method: "POST", url: `/groups/${id}/members`, headers: { cookie: bob }, payload: { nickname: "admin1" } });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("POST /groups sin sesión → 401", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "POST", url: "/groups", payload: { name: "X" } });
  assert.equal(res.statusCode, 401);
  await app.close();
});
