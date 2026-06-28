import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";

async function freshRepo() {
  const db = new PGlite();
  await runMigrations(db);
  return createAuthRepo(db);
}

test("createUser + findUserByEmail", async () => {
  const repo = await freshRepo();
  const user = await repo.createUser({
    nickname: "neo", email: "neo@x.io", passwordHash: "h", birthYear: 1990,
  });
  assert.ok(user.id);
  const found = await repo.findUserByEmail("neo@x.io");
  assert.equal(found?.nickname, "neo");
});

test("invalidateActiveCodes deja findActiveCode en null", async () => {
  const repo = await freshRepo();
  const user = await repo.createUser({
    nickname: "trinity", email: "t@x.io", passwordHash: "h", birthYear: 1988,
  });
  await repo.insertCode({ userId: user.id, codeHash: "abc", expiresAt: new Date(Date.now() + 60000) });
  assert.ok(await repo.findActiveCode(user.id));
  await repo.invalidateActiveCodes(user.id);
  assert.equal(await repo.findActiveCode(user.id), null);
});
