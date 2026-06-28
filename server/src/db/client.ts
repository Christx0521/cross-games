import { PGlite } from "@electric-sql/pglite";
import { env } from "../config/env.ts";

export function createDb(path?: string): PGlite {
  return path ? new PGlite(path) : new PGlite();
}

export const db = createDb(env.DATABASE_PATH);
