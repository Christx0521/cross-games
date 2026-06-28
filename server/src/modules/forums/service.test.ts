import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createChatRepo } from "../chat/repo.ts";
import { createForumsRepo } from "./repo.ts";
import { createForumsService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const chatRepo = createChatRepo(db);
  const repo = createForumsRepo(db);
  const service = createForumsService({ repo, chatRepo });
  return { db, service };
}

test("createForum crea conversación forum + metadatos", async () => {
  const s = await setup();
  const f = await s.service.createForum({ name: "CS2 Panamá", languageCode: "es", continent: "NA", countryCode: "PA" });
  assert.ok(f.id);
  assert.ok(f.conversation_id);
  assert.equal(f.country_code, "PA");
  assert.equal(f.language_code, "es");
});

test("createForum con continente inválido → 422", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.createForum({ name: "X", languageCode: "es", continent: "ZZ" }),
    (e: AppError) => e.statusCode === 422 && e.code === "invalid_continent"
  );
});

test("listForums filtra por país (prioritario)", async () => {
  const s = await setup();
  await s.service.createForum({ name: "CS2 Panamá", languageCode: "es", continent: "NA", countryCode: "PA" });
  await s.service.createForum({ name: "CS2 España", languageCode: "es", continent: "EU", countryCode: "ES" });
  const pa = await s.service.listForums({ country: "pa" });
  assert.equal(pa.length, 1);
  assert.equal(pa[0]!.country_code, "PA");
});

test("listForums filtra por idioma y continente", async () => {
  const s = await setup();
  await s.service.createForum({ name: "EU es", languageCode: "es", continent: "EU", countryCode: "ES" });
  await s.service.createForum({ name: "EU en", languageCode: "en", continent: "EU", countryCode: "GB" });
  const esEU = await s.service.listForums({ language: "es", continent: "EU" });
  assert.equal(esEU.length, 1);
  assert.equal(esEU[0]!.name, "EU es");
});

test("getForum inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.getForum("00000000-0000-0000-0000-000000000000"),
    (e: AppError) => e.statusCode === 404
  );
});
