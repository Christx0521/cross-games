import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthService } from "../auth/service.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { buildApp } from "../../app.ts";
import type { FastifyInstance } from "fastify";

async function makeUser(app: FastifyInstance, service: ReturnType<typeof createAuthService>, nickname: string) {
  await service.register({ nickname, email: `${nickname}@x.io`, password: "S3cret!1", birthYear: 1990 });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { identifier: nickname, password: "S3cret!1" } });
  return `sid=${login.cookies.find((c) => c.name === "sid")!.value}`;
}

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const service = createAuthService({ repo: createAuthRepo(db) });
  const app = await buildApp({ db });
  const alice = await makeUser(app, service, "alice");
  const bob = await makeUser(app, service, "bob");
  const forum = await app.inject({
    method: "POST",
    url: "/forums",
    headers: { cookie: alice },
    payload: { name: "Apex LATAM", languageCode: "es", continent: "SA" },
  });
  return { app, alice, bob, forumId: forum.json().id as string };
}

test("publicar hilo requiere sesión: sin cookie → 401", async () => {
  const { app, forumId } = await setup();
  const res = await app.inject({ method: "POST", url: `/forums/${forumId}/threads`, payload: { title: "hola" } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("crear hilo, listarlo público y votar (con sesión actualiza score)", async () => {
  const { app, alice, bob, forumId } = await setup();
  const created = await app.inject({
    method: "POST",
    url: `/forums/${forumId}/threads`,
    headers: { cookie: alice },
    payload: { title: "Mejor agente", body: "opiniones" },
  });
  assert.equal(created.statusCode, 201);
  const threadId = created.json().id as string;

  // Lectura pública (sin cookie): my_vote 0
  const anon = await app.inject({ method: "GET", url: `/forums/${forumId}/threads` });
  assert.equal(anon.statusCode, 200);
  assert.equal(anon.json().length, 1);
  assert.equal(anon.json()[0].my_vote, 0);

  // Voto de bob
  const vote = await app.inject({ method: "POST", url: `/threads/${threadId}/vote`, headers: { cookie: bob }, payload: { value: 1 } });
  assert.equal(vote.statusCode, 200);
  assert.equal(vote.json().score, 1);

  // Bob ve su voto (sesión opcional personaliza my_vote)
  const seen = await app.inject({ method: "GET", url: `/threads/${threadId}`, headers: { cookie: bob } });
  assert.equal(seen.json().my_vote, 1);
  assert.equal(seen.json().score, 1);
  await app.close();
});

test("votar sin sesión → 401", async () => {
  const { app, alice, forumId } = await setup();
  const created = await app.inject({ method: "POST", url: `/forums/${forumId}/threads`, headers: { cookie: alice }, payload: { title: "x" } });
  const threadId = created.json().id as string;
  const res = await app.inject({ method: "POST", url: `/threads/${threadId}/vote`, payload: { value: 1 } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("comentar y leer comentarios públicamente", async () => {
  const { app, alice, bob, forumId } = await setup();
  const created = await app.inject({ method: "POST", url: `/forums/${forumId}/threads`, headers: { cookie: alice }, payload: { title: "tema" } });
  const threadId = created.json().id as string;

  const c = await app.inject({ method: "POST", url: `/threads/${threadId}/comments`, headers: { cookie: bob }, payload: { body: "primero" } });
  assert.equal(c.statusCode, 201);

  const list = await app.inject({ method: "GET", url: `/threads/${threadId}/comments` });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().length, 1);
  assert.equal(list.json()[0].author_nickname, "bob");
  await app.close();
});

test("búsqueda encuentra foros por nombre y usuarios por nickname", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "GET", url: "/search?q=ap" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().forums.length, 1); // "Apex LATAM"
  assert.equal(res.json().forums[0].name, "Apex LATAM");

  const users = await app.inject({ method: "GET", url: "/search?q=ali" });
  assert.equal(users.json().users.length, 1);
  assert.equal(users.json().users[0].nickname, "alice");
  await app.close();
});
