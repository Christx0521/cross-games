import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { io as ioc, type Socket } from "socket.io-client";
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

test("dos usuarios chatean en tiempo real por socket", async () => {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");
  const bob = await makeUser(app, repo, service, "bob");

  const dm = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: alice }, payload: { nickname: "bob" } });
  const conversationId = dm.json().conversationId;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  const clientA: Socket = ioc(url, { extraHeaders: { cookie: alice }, transports: ["websocket"] });
  const clientB: Socket = ioc(url, { extraHeaders: { cookie: bob }, transports: ["websocket"] });
  await Promise.all([once(clientA, "connect"), once(clientB, "connect")]);

  const received = once(clientB, "message:new");
  clientA.emit("message:send", { conversationId, body: "hola bob" });
  const [msg] = await received;

  assert.equal(msg.body, "hola bob");
  assert.equal(msg.sender_nickname, "alice");

  clientA.close();
  clientB.close();
  await app.close();
});

test("conexión anónima se permite pero no puede postear (unauthenticated)", async () => {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");
  const dm = await app.inject({ method: "POST", url: "/conversations/dm", headers: { cookie: await makeUser(app, repo, service, "bob") }, payload: { nickname: "alice" } });
  const conversationId = dm.json().conversationId;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;

  const anon: Socket = ioc(`http://127.0.0.1:${port}`, { transports: ["websocket"], reconnection: false });
  await once(anon, "connect"); // anónimo conecta OK
  const ack = await anon.emitWithAck("message:send", { conversationId, body: "intruso" });
  assert.equal((ack as { ok: boolean; code: string }).ok, false);
  assert.equal((ack as { code: string }).code, "unauthenticated");

  void alice;
  anon.close();
  await app.close();
});

test("foro: lectura pública en vivo y posteo de usuario autenticado", async () => {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");

  const forum = await app.inject({
    method: "POST", url: "/forums", headers: { cookie: alice },
    payload: { name: "General", languageCode: "es", continent: "NA", countryCode: "PA" },
  });
  const conversationId = forum.json().conversation_id;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;

  const reader: Socket = ioc(`http://127.0.0.1:${port}`, { transports: ["websocket"], reconnection: false });
  const poster: Socket = ioc(`http://127.0.0.1:${port}`, { extraHeaders: { cookie: alice }, transports: ["websocket"], reconnection: false });
  await Promise.all([once(reader, "connect"), once(poster, "connect")]);

  reader.emit("forum:join", { conversationId });
  await new Promise((r) => setTimeout(r, 100)); // dar tiempo al join

  const received = once(reader, "message:new");
  poster.emit("message:send", { conversationId, body: "hola foro" });
  const [msg] = await received;
  assert.equal(msg.body, "hola foro");

  reader.close();
  poster.close();
  await app.close();
});
