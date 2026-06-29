import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createChatRepo } from "./repo.ts";
import { createChatService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const chatRepo = createChatRepo(db);
  const service = createChatService({ repo: chatRepo });
  const a = await authRepo.createUser({ nickname: "alice", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const b = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  const c = await authRepo.createUser({ nickname: "carol", email: "c@x.io", passwordHash: "h", birthYear: 1992 });
  return { service, a, b, c };
}

test("getOrCreateDm es idempotente entre dos usuarios", async () => {
  const s = await setup();
  const r1 = await s.service.getOrCreateDm(s.a.id, "bob");
  const r2 = await s.service.getOrCreateDm(s.b.id, "alice");
  assert.equal(r1.conversationId, r2.conversationId);
});

test("getOrCreateDm consigo mismo → 400", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.getOrCreateDm(s.a.id, "alice"),
    (e: AppError) => e.statusCode === 400 && e.code === "cannot_dm_self"
  );
});

test("postMessage exige membresía (no-miembro → 403)", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  await assert.rejects(
    s.service.postMessage(s.c.id, conversationId, "hola"),
    (e: AppError) => e.statusCode === 403 && e.code === "not_a_member"
  );
});

test("postMessage vacío → 400", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  await assert.rejects(
    s.service.postMessage(s.a.id, conversationId, "   "),
    (e: AppError) => e.statusCode === 400 && e.code === "empty_message"
  );
});

test("getHistory devuelve mensajes en orden ascendente y pagina por cursor", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  for (let i = 1; i <= 5; i++) {
    await s.service.postMessage(s.a.id, conversationId, `msg ${i}`);
  }
  const page1 = await s.service.getHistory(s.a.id, conversationId, undefined, 2);
  assert.equal(page1.messages.length, 2);
  // Página más reciente: msg 4, msg 5 (ascendente)
  assert.equal(page1.messages[0]!.body, "msg 4");
  assert.equal(page1.messages[1]!.body, "msg 5");
  assert.ok(page1.nextCursor);

  const page2 = await s.service.getHistory(s.a.id, conversationId, page1.nextCursor!, 2);
  assert.equal(page2.messages[0]!.body, "msg 2");
  assert.equal(page2.messages[1]!.body, "msg 3");
});

test("getHistory de no-miembro → 403", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  await assert.rejects(
    s.service.getHistory(s.c.id, conversationId, undefined, 30),
    (e: AppError) => e.statusCode === 403
  );
});

test("no leídos: cuenta mensajes ajenos y se limpia al marcar leído", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  await s.service.postMessage(s.b.id, conversationId, "hola 1");
  await s.service.postMessage(s.b.id, conversationId, "hola 2");

  const unreadA = await s.service.getUnreadCounts(s.a.id);
  assert.equal(unreadA.find((u) => u.conversation_id === conversationId)?.count, 2);

  // El propio emisor (bob) no tiene no leídos de sus mensajes
  const unreadB = await s.service.getUnreadCounts(s.b.id);
  assert.equal(unreadB.find((u) => u.conversation_id === conversationId), undefined);

  await s.service.markRead(s.a.id, conversationId);
  const after = await s.service.getUnreadCounts(s.a.id);
  assert.equal(after.find((u) => u.conversation_id === conversationId), undefined);
});

test("markRead de no-miembro → 403", async () => {
  const s = await setup();
  const { conversationId } = await s.service.getOrCreateDm(s.a.id, "bob");
  await assert.rejects(
    s.service.markRead(s.c.id, conversationId),
    (e: AppError) => e.statusCode === 403
  );
});
