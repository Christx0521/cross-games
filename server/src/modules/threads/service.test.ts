import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createChatRepo } from "../chat/repo.ts";
import { createForumsRepo } from "../forums/repo.ts";
import { createForumsService } from "../forums/service.ts";
import { createThreadsRepo } from "./repo.ts";
import { createThreadsService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const chatRepo = createChatRepo(db);
  const forumsRepo = createForumsRepo(db);
  const forumsService = createForumsService({ repo: forumsRepo, chatRepo });
  const threadsRepo = createThreadsRepo(db);
  const service = createThreadsService({ repo: threadsRepo, forumsRepo });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  const forum = await forumsService.createForum({ name: "Valorant LATAM", languageCode: "es", continent: "SA" });
  return { service, a, b, forum };
}

test("crear hilo y leerlo con score 0 y autor", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "GG", body: "buena partida" });
  assert.equal(t.title, "GG");
  assert.equal(t.score, 0);
  assert.equal(t.comment_count, 0);
  assert.equal(t.author_nickname, "alice");
});

test("hilo con título vacío → 422", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.createThread(s.forum.id, s.a.id, { title: "   " }),
    (e: AppError) => e.statusCode === 422 && e.code === "empty_title"
  );
});

test("hilo en foro inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.createThread("00000000-0000-0000-0000-000000000000", s.a.id, { title: "x" }),
    (e: AppError) => e.statusCode === 404 && e.code === "forum_not_found"
  );
});

test("votar hilo: up/cambiar a down/quitar; my_vote refleja el voto del usuario", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "vota" });

  const up = await s.service.voteThread(t.id, s.b.id, 1);
  assert.equal(up.score, 1);

  const seenByB = await s.service.getThread(t.id, s.b.id);
  assert.equal(seenByB.score, 1);
  assert.equal(seenByB.my_vote, 1);

  const down = await s.service.voteThread(t.id, s.b.id, -1);
  assert.equal(down.score, -1);

  const removed = await s.service.voteThread(t.id, s.b.id, 0);
  assert.equal(removed.score, 0);
  const after = await s.service.getThread(t.id, s.b.id);
  assert.equal(after.my_vote, 0);
});

test("voto inválido → 422", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "vota" });
  await assert.rejects(
    s.service.voteThread(t.id, s.b.id, 2),
    (e: AppError) => e.statusCode === 422 && e.code === "invalid_vote"
  );
});

test("comentarios: raíz y respuesta anidada; comment_count aumenta", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "tema" });

  const root = await s.service.addComment(t.id, s.b.id, { body: "primer comentario" });
  assert.equal(root.parent_id, null);
  assert.equal(root.author_nickname, "bob");

  const reply = await s.service.addComment(t.id, s.a.id, { body: "respuesta", parentId: root.id });
  assert.equal(reply.parent_id, root.id);

  const comments = await s.service.listComments(t.id, null);
  assert.equal(comments.length, 2);

  const refreshed = await s.service.getThread(t.id, null);
  assert.equal(refreshed.comment_count, 2);
});

test("comentario vacío → 422", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "tema" });
  await assert.rejects(
    s.service.addComment(t.id, s.b.id, { body: "  " }),
    (e: AppError) => e.statusCode === 422 && e.code === "empty_comment"
  );
});

test("respuesta a comentario de otro hilo → 422 invalid_parent", async () => {
  const s = await setup();
  const t1 = await s.service.createThread(s.forum.id, s.a.id, { title: "uno" });
  const t2 = await s.service.createThread(s.forum.id, s.a.id, { title: "dos" });
  const c1 = await s.service.addComment(t1.id, s.b.id, { body: "en t1" });
  await assert.rejects(
    s.service.addComment(t2.id, s.b.id, { body: "cruzado", parentId: c1.id }),
    (e: AppError) => e.statusCode === 422 && e.code === "invalid_parent"
  );
});

test("votar comentario actualiza score", async () => {
  const s = await setup();
  const t = await s.service.createThread(s.forum.id, s.a.id, { title: "tema" });
  const c = await s.service.addComment(t.id, s.b.id, { body: "útil" });
  const r = await s.service.voteComment(c.id, s.a.id, 1);
  assert.equal(r.score, 1);
  const comments = await s.service.listComments(t.id, s.a.id);
  assert.equal(comments[0]!.score, 1);
  assert.equal(comments[0]!.my_vote, 1);
});

test("orden top prioriza el hilo con más score", async () => {
  const s = await setup();
  const t1 = await s.service.createThread(s.forum.id, s.a.id, { title: "poco" });
  const t2 = await s.service.createThread(s.forum.id, s.a.id, { title: "mucho" });
  await s.service.voteThread(t2.id, s.b.id, 1);

  const top = await s.service.listThreads(s.forum.id, "top", null);
  assert.equal(top[0]!.id, t2.id);
  assert.equal(top[0]!.title, "mucho");
});
