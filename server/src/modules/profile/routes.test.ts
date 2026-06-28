import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createAuthService } from "../auth/service.ts";
import { hashCode } from "../../lib/code.ts";
import { buildApp } from "../../app.ts";

const creds = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

async function appWithLogin() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  await service.register(creds);
  const user = await repo.findUserByEmail(creds.email);
  await repo.invalidateActiveCodes(user!.id);
  await repo.insertCode({
    userId: user!.id,
    codeHash: hashCode("1234567", creds.email),
    expiresAt: new Date(Date.now() + 60000),
  });
  await service.verifyEmail({ email: creds.email, code: "1234567" });
  const app = await buildApp({ db });
  const login = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: creds.password },
  });
  const sid = login.cookies.find((c) => c.name === "sid")!;
  return { app, cookie: `sid=${sid.value}` };
}

test("GET /users/:nickname es público y no expone datos sensibles", async () => {
  const { app } = await appWithLogin();
  const res = await app.inject({ method: "GET", url: "/users/neo" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.nickname, "neo");
  assert.equal(body.is_adult, true);
  assert.ok(!("email" in body));
  assert.ok(!("birth_year" in body));
  await app.close();
});

test("GET /users/:nickname inexistente → 404", async () => {
  const { app } = await appWithLogin();
  const res = await app.inject({ method: "GET", url: "/users/ghost" });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test("PATCH /me/profile sin sesión → 401", async () => {
  const { app } = await appWithLogin();
  const res = await app.inject({
    method: "PATCH", url: "/me/profile", payload: { description: "hola" },
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("PATCH /me/profile con sesión actualiza y devuelve el perfil", async () => {
  const { app, cookie } = await appWithLogin();
  const res = await app.inject({
    method: "PATCH", url: "/me/profile",
    headers: { cookie },
    payload: { description: "pro gamer", countryCode: "pa", languages: ["es", "en"] },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.description, "pro gamer");
  assert.equal(body.country_code, "PA");
  assert.deepEqual(body.languages, ["en", "es"]);
  await app.close();
});
