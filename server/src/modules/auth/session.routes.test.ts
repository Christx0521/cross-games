import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createAuthService } from "./service.ts";
import { buildApp } from "../../app.ts";

const creds = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

async function appWithVerifiedUser() {
  const db = new PGlite();
  await runMigrations(db);
  const repo = createAuthRepo(db);
  const service = createAuthService({ repo });
  await service.register(creds);
  return buildApp({ db });
}

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }): string {
  const c = res.cookies.find((x) => x.name === "sid");
  return c ? `sid=${c.value}` : "";
}

test("login devuelve user y setea cookie sid", async () => {
  const app = await appWithVerifiedUser();
  const res = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: creds.password },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.nickname, "neo");
  assert.ok(res.cookies.some((c) => c.name === "sid" && c.value.length > 0));
  await app.close();
});

test("login con credenciales malas → 401", async () => {
  const app = await appWithVerifiedUser();
  const res = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: "nope" },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, "invalid_credentials");
  await app.close();
});

test("me sin cookie → 401 unauthenticated", async () => {
  const app = await appWithVerifiedUser();
  const res = await app.inject({ method: "GET", url: "/auth/me" });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, "unauthenticated");
  await app.close();
});

test("me con cookie de login → 200 con el usuario", async () => {
  const app = await appWithVerifiedUser();
  const login = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: creds.password },
  });
  const res = await app.inject({
    method: "GET", url: "/auth/me",
    headers: { cookie: cookieFrom(login) },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.email, "neo@x.io");
  await app.close();
});

test("logout invalida la sesión: me posterior → 401", async () => {
  const app = await appWithVerifiedUser();
  const login = await app.inject({
    method: "POST", url: "/auth/login",
    payload: { identifier: creds.email, password: creds.password },
  });
  const cookie = cookieFrom(login);
  await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
  const res = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
  assert.equal(res.statusCode, 401);
  await app.close();
});
