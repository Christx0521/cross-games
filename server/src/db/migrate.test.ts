import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "./migrate.ts";

test("runMigrations crea tablas y es idempotente", async () => {
  const db = new PGlite();
  await runMigrations(db);
  await runMigrations(db); // segunda vez no debe fallar

  const users = await db.query("SELECT count(*) AS n FROM users");
  assert.equal(Number((users.rows[0] as { n: number | string }).n), 0);

  const applied = await db.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name"
  );
  assert.ok(applied.rows.some((r) => r.name === "001_init.sql"));
});
