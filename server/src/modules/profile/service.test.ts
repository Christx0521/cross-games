import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createProfileRepo } from "./repo.ts";
import { createProfileService } from "./service.ts";
import { AppError } from "../../lib/errors.ts";

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const profileRepo = createProfileRepo(db);
  const service = createProfileService({ repo: profileRepo });
  const user = await authRepo.createUser({
    nickname: "neo", email: "neo@x.io", passwordHash: "h", birthYear: 1990,
  });
  return { db, profileRepo, service, user };
}

test("getPublicProfile no expone email ni birth_year, sí is_adult", async () => {
  const s = await setup();
  const p = await s.service.getPublicProfile("neo");
  assert.equal(p.nickname, "neo");
  assert.equal(p.is_adult, true);
  assert.deepEqual(p.languages, []);
  assert.ok(!("email" in p));
  assert.ok(!("birth_year" in p));
});

test("getPublicProfile de nickname inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.getPublicProfile("ghost"),
    (e: AppError) => e.statusCode === 404 && e.code === "user_not_found"
  );
});

test("updateProfile guarda description, country e idiomas (normalizados)", async () => {
  const s = await setup();
  await s.service.updateProfile(s.user.id, {
    description: "  gamer  ",
    countryCode: "pa",
    languages: ["ES", "en", "es"],
  });
  const p = await s.service.getPublicProfile("neo");
  assert.equal(p.description, "gamer");
  assert.equal(p.country_code, "PA");
  assert.deepEqual(p.languages, ["en", "es"]);
});

test("updateProfile con country inválido → 422", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.updateProfile(s.user.id, { countryCode: "PAN" }),
    (e: AppError) => e.statusCode === 422 && e.code === "invalid_country_code"
  );
});

test("setAvatarUrl se refleja en el perfil público", async () => {
  const s = await setup();
  await s.profileRepo.setAvatarUrl(s.user.id, "/uploads/a.png");
  const p = await s.service.getPublicProfile("neo");
  assert.equal(p.avatar_url, "/uploads/a.png");
});
