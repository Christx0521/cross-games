import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { buildApp } from "../../app.ts";

async function appWithDb() {
  const db = new PGlite();
  await runMigrations(db);
  return buildApp({ db });
}

const body = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

test("POST /auth/register devuelve 201", async () => {
  const app = await appWithDb();
  const res = await app.inject({ method: "POST", url: "/auth/register", payload: body });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().email, "neo@x.io");
  await app.close();
});

test("POST /auth/register menor → 422 underage", async () => {
  const app = await appWithDb();
  const res = await app.inject({
    method: "POST", url: "/auth/register",
    payload: { ...body, birthYear: new Date().getUTCFullYear() - 5 },
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().code, "underage");
  await app.close();
});

test("POST /auth/register duplicado → 409", async () => {
  const app = await appWithDb();
  await app.inject({ method: "POST", url: "/auth/register", payload: body });
  const res = await app.inject({ method: "POST", url: "/auth/register", payload: { ...body, nickname: "zion" } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().code, "email_taken");
  await app.close();
});

test("POST /auth/register payload inválido → 400 invalid_request", async () => {
  const app = await appWithDb();
  const res = await app.inject({
    method: "POST", url: "/auth/register",
    payload: { nickname: "ab", email: "not-an-email", password: "x", birthYear: 1990 },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "invalid_request");
  await app.close();
});

test("GET /health → ok", async () => {
  const app = await appWithDb();
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.json().status, "ok");
  await app.close();
});
