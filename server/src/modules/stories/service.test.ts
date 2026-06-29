import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createFriendsRepo } from "../friends/repo.ts";
import { createModerationRepo } from "../moderation/repo.ts";
import { createModerationService } from "../moderation/service.ts";
import { createStoriesRepo } from "./repo.ts";
import { createStoriesService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const friendsRepo = createFriendsRepo(db);
  const moderation = createModerationService({ repo: createModerationRepo(db) });
  const service = createStoriesService({ repo: createStoriesRepo(db), friendsRepo, blockedIds: moderation.blockedIds });

  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  const c = await authRepo.createUser({ nickname: "carol", email: "c@x.io", passwordHash: "h", birthYear: 1992 });
  // alice y bob amigos; carol no
  const fr = await friendsRepo.createRequest(a.id, b.id);
  await friendsRepo.accept(fr.id);
  return { db, service, moderation, a, b, c };
}

test("getActive agrupa por autor: propias + de amigos, excluye no-amigos", async () => {
  const s = await setup();
  await s.service.createStory(s.a.id, "/uploads/a1.png", "yo");
  await s.service.createStory(s.b.id, "/uploads/b1.png", "amigo");
  await s.service.createStory(s.c.id, "/uploads/c1.png", "ajeno");

  const groups = await s.service.getActive(s.a.id);
  const ids = groups.map((g) => g.author.id);
  assert.ok(ids.includes(s.a.id));
  assert.ok(ids.includes(s.b.id));
  assert.ok(!ids.includes(s.c.id));
  // yo primero
  assert.equal(groups[0]!.is_me, true);
});

test("marcar visto apaga has_unseen del grupo del amigo", async () => {
  const s = await setup();
  const { id } = await s.service.createStory(s.b.id, "/uploads/b1.png", "hola");

  const before = await s.service.getActive(s.a.id);
  assert.equal(before.find((g) => g.author.id === s.b.id)!.has_unseen, true);

  await s.service.view(id, s.a.id);
  const after = await s.service.getActive(s.a.id);
  assert.equal(after.find((g) => g.author.id === s.b.id)!.has_unseen, false);
});

test("las stories expiradas no aparecen", async () => {
  const s = await setup();
  // story de bob ya expirada (insert directo con expires_at en el pasado)
  await s.db.query(
    "INSERT INTO stories (author_id, image_url, caption, expires_at) VALUES ($1, $2, $3, now() - interval '1 hour')",
    [s.b.id, "/uploads/old.png", "vieja"]
  );
  const groups = await s.service.getActive(s.a.id);
  assert.equal(groups.find((g) => g.author.id === s.b.id), undefined);
});

test("borrar story ajena → 403; propia → ok", async () => {
  const s = await setup();
  const { id } = await s.service.createStory(s.a.id, "/uploads/a1.png", "mía");
  await assert.rejects(
    s.service.deleteStory(id, s.b.id),
    (e: AppError) => e.statusCode === 403 && e.code === "not_the_author"
  );
  await s.service.deleteStory(id, s.a.id);
  await assert.rejects(
    s.service.view(id, s.a.id),
    (e: AppError) => e.statusCode === 404 && e.code === "story_not_found"
  );
});

test("bloqueo oculta las stories del usuario bloqueado", async () => {
  const s = await setup();
  await s.service.createStory(s.b.id, "/uploads/b1.png", "hola");
  await s.moderation.block(s.a.id, "bob");
  const groups = await s.service.getActive(s.a.id);
  assert.equal(groups.find((g) => g.author.id === s.b.id), undefined);
});

test("caption demasiado largo → 422", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.createStory(s.a.id, "/uploads/a.png", "x".repeat(281)),
    (e: AppError) => e.statusCode === 422 && e.code === "caption_too_long"
  );
});
