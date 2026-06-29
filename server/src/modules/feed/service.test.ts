import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createFriendsRepo } from "../friends/repo.ts";
import { createFeedRepo } from "./repo.ts";
import { createFeedService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const friendsRepo = createFriendsRepo(db);
  const feedRepo = createFeedRepo(db);
  const service = createFeedService({ repo: feedRepo, friendsRepo });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  const c = await authRepo.createUser({ nickname: "carol", email: "c@x.io", passwordHash: "h", birthYear: 1992 });
  // alice y bob son amigos; carol no.
  const fr = await friendsRepo.createRequest(a.id, b.id);
  await friendsRepo.accept(fr.id);
  return { service, friendsRepo, a, b, c };
}

test("crear post vacío sin imagen → 422", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.createPost(s.a.id, "   "),
    (e: AppError) => e.statusCode === 422 && e.code === "empty_post"
  );
});

test("post con solo imagen (sin texto) se permite", async () => {
  const s = await setup();
  const p = await s.service.createPost(s.a.id, "", "/uploads/x.png");
  assert.equal(p.attachment_url, "/uploads/x.png");
  assert.equal(p.body, "");
  assert.equal(p.author_nickname, "alice");
});

test("feed incluye posts propios y de amigos, excluye a no-amigos", async () => {
  const s = await setup();
  await s.service.createPost(s.a.id, "post de alice");
  await s.service.createPost(s.b.id, "post de bob (amigo)");
  await s.service.createPost(s.c.id, "post de carol (no amigo)");

  const feed = await s.service.getFeed(s.a.id, undefined, 20);
  const bodies = feed.posts.map((p) => p.body);
  assert.ok(bodies.includes("post de alice"));
  assert.ok(bodies.includes("post de bob (amigo)"));
  assert.ok(!bodies.includes("post de carol (no amigo)"));
});

test("feed ordena por seq descendente (más nuevo primero) y pagina", async () => {
  const s = await setup();
  for (let i = 1; i <= 3; i++) await s.service.createPost(s.a.id, `p${i}`);
  const page1 = await s.service.getFeed(s.a.id, undefined, 2);
  assert.equal(page1.posts.length, 2);
  assert.equal(page1.posts[0]!.body, "p3");
  assert.equal(page1.posts[1]!.body, "p2");
  assert.ok(page1.nextCursor);

  const page2 = await s.service.getFeed(s.a.id, page1.nextCursor!, 2);
  assert.equal(page2.posts[0]!.body, "p1");
  assert.equal(page2.nextCursor, null);
});

test("like es idempotente como toggle y cuenta refleja", async () => {
  const s = await setup();
  const p = await s.service.createPost(s.a.id, "dale like");

  const r1 = await s.service.toggleLike(p.id, s.b.id);
  assert.deepEqual(r1, { liked: true, like_count: 1 });

  const seen = await s.service.getFeed(s.b.id, undefined, 20);
  const post = seen.posts.find((x) => x.id === p.id)!;
  assert.equal(post.liked, true);
  assert.equal(post.like_count, 1);

  const r2 = await s.service.toggleLike(p.id, s.b.id);
  assert.deepEqual(r2, { liked: false, like_count: 0 });
});

test("comentar y listar comentarios", async () => {
  const s = await setup();
  const p = await s.service.createPost(s.a.id, "tema");
  await s.service.addComment(p.id, s.b.id, "buen post");
  const comments = await s.service.listComments(p.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0]!.author_nickname, "bob");

  const refreshed = await s.service.getFeed(s.a.id, undefined, 20);
  assert.equal(refreshed.posts.find((x) => x.id === p.id)!.comment_count, 1);
});

test("borrar post ajeno → 403; propio → ok", async () => {
  const s = await setup();
  const p = await s.service.createPost(s.a.id, "mío");
  await assert.rejects(
    s.service.deletePost(p.id, s.b.id),
    (e: AppError) => e.statusCode === 403 && e.code === "not_the_author"
  );
  await s.service.deletePost(p.id, s.a.id);
  await assert.rejects(
    s.service.toggleLike(p.id, s.a.id),
    (e: AppError) => e.statusCode === 404
  );
});

test("muro de usuario por nickname devuelve solo sus posts", async () => {
  const s = await setup();
  await s.service.createPost(s.a.id, "a1");
  await s.service.createPost(s.b.id, "b1");
  const wall = await s.service.getWall("alice", null, undefined, 20);
  assert.equal(wall.posts.length, 1);
  assert.equal(wall.posts[0]!.body, "a1");
});

test("muro de nickname inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.getWall("ghost", null, undefined, 20),
    (e: AppError) => e.statusCode === 404 && e.code === "user_not_found"
  );
});
