import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function runMigrations(database: PGlite): Promise<void> {
  await database.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     );`
  );

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const done = await database.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [name]
    );
    if (done.rows.length > 0) continue;

    const sql = await readFile(join(migrationsDir, name), "utf8");
    await database.exec(sql);
    await database.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
  }
}
