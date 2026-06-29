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
  return { app, alice, bob };
}

test("GET /feed sin sesión → 401", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "GET", url: "/feed" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("crear post, verlo en el feed y darle like", async () => {
  const { app, alice } = await setup();
  const created = await app.inject({ method: "POST", url: "/posts", headers: { cookie: alice }, payload: { body: "hola mundo" } });
  assert.equal(created.statusCode, 201);
  const postId = created.json().id as string;

  const feed = await app.inject({ method: "GET", url: "/feed", headers: { cookie: alice } });
  assert.equal(feed.statusCode, 200);
  assert.equal(feed.json().posts.length, 1);
  assert.equal(feed.json().posts[0].body, "hola mundo");

  const like = await app.inject({ method: "POST", url: `/posts/${postId}/like`, headers: { cookie: alice } });
  assert.equal(like.statusCode, 200);
  assert.deepEqual(like.json(), { liked: true, like_count: 1 });
  await app.close();
});

test("subir imagen como post (multipart) crea post con attachment_url", async () => {
  const { app, alice } = await setup();
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"); // cabecera PNG
  const boundary = "----feedtest";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\nmira esto\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await app.inject({
    method: "POST",
    url: "/posts/attachment",
    headers: { cookie: alice, "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body,
  });
  assert.equal(res.statusCode, 201);
  assert.ok(res.json().attachment_url.startsWith("/uploads/"));
  assert.equal(res.json().body, "mira esto");
  await app.close();
});

test("muro público de un usuario es legible sin sesión", async () => {
  const { app, bob } = await setup();
  await app.inject({ method: "POST", url: "/posts", headers: { cookie: bob }, payload: { body: "soy bob" } });
  const wall = await app.inject({ method: "GET", url: "/users/bob/posts" });
  assert.equal(wall.statusCode, 200);
  assert.equal(wall.json().posts.length, 1);
  assert.equal(wall.json().posts[0].author_nickname, "bob");
  await app.close();
});
