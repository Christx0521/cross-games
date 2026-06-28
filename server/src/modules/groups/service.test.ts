import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createGroupsRepo } from "./repo.ts";
import { createGroupsService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const repo = createGroupsRepo(db);
  const service = createGroupsService({ repo });
  const admin = await authRepo.createUser({ nickname: "admin1", email: "a@x.io", passwordHash: "h", birthYear: 1990 });
  const bob = await authRepo.createUser({ nickname: "bob", email: "b@x.io", passwordHash: "h", birthYear: 1991 });
  return { db, authRepo, repo, service, admin, bob };
}

test("createGroup deja al creador como admin y lo lista", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  assert.ok(g.id);
  const groups = await s.service.listGroups(s.admin.id);
  assert.equal(groups[0]!.name, "Squad");
  assert.equal(groups[0]!.role, "admin");
});

test("admin agrega miembro por nickname", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  await s.service.addMember(s.admin.id, g.id, "bob");
  const groupsOfBob = await s.service.listGroups(s.bob.id);
  assert.equal(groupsOfBob.length, 1);
  assert.equal(groupsOfBob[0]!.role, "member");
});

test("un no-admin no puede agregar → 403", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  await s.service.addMember(s.admin.id, g.id, "bob");
  await assert.rejects(
    s.service.addMember(s.bob.id, g.id, "admin1"),
    (e: AppError) => e.statusCode === 403 && e.code === "not_admin"
  );
});

test("agregar miembro duplicado → 409 already_member", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  await s.service.addMember(s.admin.id, g.id, "bob");
  await assert.rejects(
    s.service.addMember(s.admin.id, g.id, "bob"),
    (e: AppError) => e.statusCode === 409 && e.code === "already_member"
  );
});

test("respeta el tope de 20 miembros → 409 group_full", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  // admin ya ocupa 1; agregamos 19 hasta llegar a 20
  for (let i = 0; i < 19; i++) {
    const u = await s.authRepo.createUser({ nickname: `u${i}`, email: `u${i}@x.io`, passwordHash: "h", birthYear: 1990 });
    await s.repo.addMemberIfRoom(g.id, u.id, 20);
  }
  await assert.rejects(
    s.service.addMember(s.admin.id, g.id, "bob"),
    (e: AppError) => e.statusCode === 409 && e.code === "group_full"
  );
});

test("admin no puede quitarse a sí mismo → 400", async () => {
  const s = await setup();
  const g = await s.service.createGroup(s.admin.id, "Squad");
  await assert.rejects(
    s.service.removeMember(s.admin.id, g.id, s.admin.id),
    (e: AppError) => e.statusCode === 400 && e.code === "cannot_remove_self"
  );
});
