import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createFriendsRepo } from "../friends/repo.ts";
import { createFeedRepo } from "../feed/repo.ts";
import { createFeedService } from "../feed/service.ts";
import { createNotificationsRepo } from "./repo.ts";
import { createNotificationsService, extractMentions, type Emit } from "./service.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const notifRepo = createNotificationsRepo(db);
  const emitted: Array<{ userId: string; event: string; payload: unknown }> = [];
  const emit: Emit = (userId, event, payload) => emitted.push({ userId, event, payload });
  const service = createNotificationsService({ repo: notifRepo, emit });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  return { db, authRepo, service, emitted, a, b };
}

test("extractMentions saca nicks únicos y respeta longitud", () => {
  assert.deepEqual(extractMentions("hola @bob y @bob de nuevo, @al"), ["bob"]); // "al" <3 se ignora
  assert.deepEqual(extractMentions("@alice @bob_99"), ["alice", "bob_99"]);
  assert.deepEqual(extractMentions("sin menciones"), []);
});

test("direct persiste, emite y suma a no leídos", async () => {
  const s = await setup();
  await s.service.direct({
    recipientId: s.b.id,
    actorId: s.a.id,
    type: "post_like",
    entityType: "post",
    entityId: null,
    preview: "le gustó tu post",
  });
  assert.equal(await s.service.unreadCount(s.b.id), 1);
  assert.equal(s.emitted.length, 1);
  assert.equal(s.emitted[0]!.event, "notification:new");
  assert.equal(s.emitted[0]!.userId, s.b.id);
});

test("direct no se notifica a sí mismo", async () => {
  const s = await setup();
  await s.service.direct({ recipientId: s.a.id, actorId: s.a.id, type: "post_like", entityType: "post", entityId: null, preview: "x" });
  assert.equal(await s.service.unreadCount(s.a.id), 0);
  assert.equal(s.emitted.length, 0);
});

test("mentions resuelve nicks, omite al actor y deduplica", async () => {
  const s = await setup();
  // alice menciona a bob (existe) y a alice (a sí misma → omitido) y a ghost (no existe)
  await s.service.mentions({
    text: "hey @bob y @alice y @ghost",
    actorId: s.a.id,
    entityType: "post",
    entityId: null,
    preview: "hey",
  });
  assert.equal(await s.service.unreadCount(s.b.id), 1);
  assert.equal(await s.service.unreadCount(s.a.id), 0);
  const page = await s.service.list(s.b.id, undefined, 20);
  assert.equal(page.notifications[0]!.type, "mention");
  assert.equal(page.notifications[0]!.actor_nickname, "alice");
});

test("markAllRead limpia el contador", async () => {
  const s = await setup();
  await s.service.direct({ recipientId: s.b.id, actorId: s.a.id, type: "post_comment", entityType: "post", entityId: null, preview: "c" });
  assert.equal(await s.service.unreadCount(s.b.id), 1);
  await s.service.markAllRead(s.b.id);
  assert.equal(await s.service.unreadCount(s.b.id), 0);
});

test("list pagina por cursor descendente", async () => {
  const s = await setup();
  for (let i = 0; i < 3; i++) {
    await s.service.direct({ recipientId: s.b.id, actorId: s.a.id, type: "mention", entityType: "post", entityId: null, preview: `n${i}` });
  }
  const p1 = await s.service.list(s.b.id, undefined, 2);
  assert.equal(p1.notifications.length, 2);
  assert.ok(p1.nextCursor);
  const p2 = await s.service.list(s.b.id, p1.nextCursor!, 2);
  assert.equal(p2.notifications.length, 1);
  assert.equal(p2.nextCursor, null);
});

test("integración: like y comentario en un post generan notificación al autor", async () => {
  const s = await setup();
  const friendsRepo = createFriendsRepo(s.db);
  const feedRepo = createFeedRepo(s.db);
  const feed = createFeedService({ repo: feedRepo, friendsRepo, notifier: s.service });

  const post = await feed.createPost(s.a.id, "mi post");
  await feed.toggleLike(post.id, s.b.id);
  await feed.addComment(post.id, s.b.id, "buen post @alice");

  // alice (autora) recibe: like + comentario + mención = 3
  assert.equal(await s.service.unreadCount(s.a.id), 3);
});

test("integración: dar unlike no genera notificación", async () => {
  const s = await setup();
  const friendsRepo = createFriendsRepo(s.db);
  const feedRepo = createFeedRepo(s.db);
  const feed = createFeedService({ repo: feedRepo, friendsRepo, notifier: s.service });

  const post = await feed.createPost(s.a.id, "mi post");
  await feed.toggleLike(post.id, s.b.id); // like → 1
  await feed.toggleLike(post.id, s.b.id); // unlike → no nueva
  assert.equal(await s.service.unreadCount(s.a.id), 1);
});
