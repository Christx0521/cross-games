import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createFriendsRepo } from "./repo.ts";
import { createFriendsService, type Notify } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const friendsRepo = createFriendsRepo(db);
  const events: Array<{ userId: string; event: string; payload: unknown }> = [];
  const notify: Notify = (userId, event, payload) => events.push({ userId, event, payload });
  const service = createFriendsService({ repo: friendsRepo, notify });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  return { service, events, a, b };
}

test("requestFriend crea pending y notifica al destinatario", async () => {
  const s = await setup();
  const res = await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  assert.equal(res.status, "pending");
  assert.equal(s.events.at(-1)?.event, "friend:request");
  assert.equal(s.events.at(-1)?.userId, s.b.id);
});

test("solicitud inversa auto-acepta (B pide a A tras A pedir a B)", async () => {
  const s = await setup();
  await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  const res = await s.service.requestFriend({ id: s.b.id, nickname: "bob" }, "alice");
  assert.equal(res.status, "accepted");
  const friendsOfA = await s.service.listFriends(s.a.id);
  assert.equal(friendsOfA.length, 1);
  assert.equal(friendsOfA[0]!.nickname, "bob");
});

test("no puedo agregarme a mí mismo → 400", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "alice"),
    (e: AppError) => e.statusCode === 400 && e.code === "cannot_add_self"
  );
});

test("solicitud duplicada → 409 already_requested", async () => {
  const s = await setup();
  await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  await assert.rejects(
    s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob"),
    (e: AppError) => e.statusCode === 409 && e.code === "already_requested"
  );
});

test("nickname inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "ghost"),
    (e: AppError) => e.statusCode === 404 && e.code === "user_not_found"
  );
});

test("accept por el destinatario los hace amigos y notifica al solicitante", async () => {
  const s = await setup();
  const req = await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  const reqs = await s.service.listRequests(s.b.id);
  assert.equal(reqs.length, 1);
  await s.service.accept(s.b.id, req.friendshipId);
  assert.equal((await s.service.listFriends(s.a.id)).length, 1);
  assert.ok(s.events.some((e) => e.event === "friend:accepted" && e.userId === s.a.id));
});

test("accept por quien no es el destinatario → 403", async () => {
  const s = await setup();
  const req = await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  await assert.rejects(
    s.service.accept(s.a.id, req.friendshipId),
    (e: AppError) => e.statusCode === 403
  );
});

test("reject elimina la solicitud", async () => {
  const s = await setup();
  const req = await s.service.requestFriend({ id: s.a.id, nickname: "alice" }, "bob");
  await s.service.reject(s.b.id, req.friendshipId);
  assert.equal((await s.service.listRequests(s.b.id)).length, 0);
  assert.equal((await s.service.listFriends(s.a.id)).length, 0);
});
