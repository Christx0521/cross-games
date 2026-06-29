import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createChatRepo } from "../chat/repo.ts";
import { createChatService } from "../chat/service.ts";
import { createFriendsRepo } from "../friends/repo.ts";
import { createFriendsService } from "../friends/service.ts";
import { createFeedRepo } from "../feed/repo.ts";
import { createFeedService } from "../feed/service.ts";
import { createModerationRepo } from "./repo.ts";
import { createModerationService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const moderation = createModerationService({ repo: createModerationRepo(db) });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  return { db, authRepo, moderation, a, b };
}

test("block es idempotente, aparece en la lista y no permite bloquearse a sí mismo", async () => {
  const s = await setup();
  await s.moderation.block(s.a.id, "bob");
  await s.moderation.block(s.a.id, "bob"); // idempotente
  const list = await s.moderation.listBlocked(s.a.id);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.nickname, "bob");

  await assert.rejects(
    s.moderation.block(s.a.id, "alice"),
    (e: AppError) => e.statusCode === 400 && e.code === "cannot_block_self"
  );
});

test("isBlocked detecta el bloqueo en ambas direcciones; unblock lo limpia", async () => {
  const s = await setup();
  await s.moderation.block(s.a.id, "bob");
  assert.equal(await s.moderation.isBlocked(s.a.id, s.b.id), true);
  assert.equal(await s.moderation.isBlocked(s.b.id, s.a.id), true); // ambas direcciones

  await s.moderation.unblock(s.a.id, s.b.id);
  assert.equal(await s.moderation.isBlocked(s.a.id, s.b.id), false);
});

test("report valida el tipo de objetivo", async () => {
  const s = await setup();
  const r = await s.moderation.report(s.a.id, { targetType: "post", targetId: s.b.id, reason: "spam" });
  assert.ok(r.id);
  await assert.rejects(
    s.moderation.report(s.a.id, { targetType: "banana", targetId: s.b.id }),
    (e: AppError) => e.statusCode === 422 && e.code === "invalid_target_type"
  );
});

test("enforcement: con bloqueo no se puede abrir DM ni mandar solicitud de amistad", async () => {
  const s = await setup();
  await s.moderation.block(s.a.id, "bob");

  const chat = createChatService({ repo: createChatRepo(s.db), isBlocked: s.moderation.isBlocked });
  await assert.rejects(
    chat.getOrCreateDm(s.b.id, "alice"),
    (e: AppError) => e.statusCode === 403 && e.code === "blocked"
  );

  const friends = createFriendsService({ repo: createFriendsRepo(s.db), isBlocked: s.moderation.isBlocked });
  await assert.rejects(
    friends.requestFriend({ id: s.b.id, nickname: "bob" }, "alice"),
    (e: AppError) => e.statusCode === 403 && e.code === "blocked"
  );
});

test("enforcement: el feed oculta posts de usuarios bloqueados (ambas direcciones)", async () => {
  const s = await setup();
  const friendsRepo = createFriendsRepo(s.db);
  const feedRepo = createFeedRepo(s.db);
  const feed = createFeedService({ repo: feedRepo, friendsRepo, blockedIds: s.moderation.blockedIds });

  // a y b amigos
  const fr = await friendsRepo.createRequest(s.a.id, s.b.id);
  await friendsRepo.accept(fr.id);
  await feed.createPost(s.b.id, "hola desde bob");

  // antes de bloquear, alice ve el post de bob
  const before = await feed.getFeed(s.a.id, undefined, 20);
  assert.ok(before.posts.some((p) => p.body === "hola desde bob"));

  // bob bloquea a alice → alice no debe ver los posts de bob
  await s.moderation.block(s.b.id, "alice");
  const after = await feed.getFeed(s.a.id, undefined, 20);
  assert.ok(!after.posts.some((p) => p.body === "hola desde bob"));
});
