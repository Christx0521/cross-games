import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { io as ioc, type Socket } from "socket.io-client";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createAuthService } from "../auth/service.ts";
import { createFriendsRepo } from "../friends/repo.ts";
import { createFriendsService } from "../friends/service.ts";
import { buildApp } from "../../app.ts";
import type { FastifyInstance } from "fastify";

async function makeUser(app: FastifyInstance, repo: ReturnType<typeof createAuthRepo>, service: ReturnType<typeof createAuthService>, nickname: string) {
  const email = `${nickname}@x.io`;
  await service.register({ nickname, email, password: "S3cret!1", birthYear: 1990 });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { identifier: nickname, password: "S3cret!1" } });
  return `sid=${login.cookies.find((c) => c.name === "sid")!.value}`;
}

test("un amigo recibe presence:update cuando el otro se conecta", async () => {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  const app = await buildApp({ db });
  const alice = await makeUser(app, repo, service, "alice");
  const bob = await makeUser(app, repo, service, "bob");

  // alice y bob se hacen amigos (request + auto-accept inverso)
  const friendsRepo = createFriendsRepo(db);
  const friendsService = createFriendsService({ repo: friendsRepo });
  const aliceUser = await repo.findUserByEmail("alice@x.io");
  const bobUser = await repo.findUserByEmail("bob@x.io");
  await friendsService.requestFriend({ id: aliceUser!.id, nickname: "alice" }, "bob");
  await friendsService.requestFriend({ id: bobUser!.id, nickname: "bob" }, "alice");

  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  const clientA: Socket = ioc(url, { extraHeaders: { cookie: alice }, transports: ["websocket"] });
  await once(clientA, "connect");

  const update = once(clientA, "presence:update");
  const clientB: Socket = ioc(url, { extraHeaders: { cookie: bob }, transports: ["websocket"] });
  await once(clientB, "connect");

  const [payload] = await update;
  assert.equal(payload.userId, bobUser!.id);
  assert.equal(payload.online, true);

  clientA.close();
  clientB.close();
  await app.close();
});
