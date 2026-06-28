import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createSessionRepo } from "./session.repo.ts";
import { createAuthService } from "./service.ts";
import { createSessionService } from "./session.service.ts";
import { hashCode } from "../../lib/code.ts";
import { AppError } from "../../lib/errors.ts";

const creds = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const sessionRepo = createSessionRepo(db);
  const authService = createAuthService({ repo: authRepo });
  const sessionService = createSessionService({ authRepo, sessionRepo });
  return { db, authRepo, sessionRepo, authService, sessionService };
}

async function registerAndVerify(s: Awaited<ReturnType<typeof setup>>) {
  await s.authService.register(creds);
  const user = await s.authRepo.findUserByEmail(creds.email);
  await s.authRepo.invalidateActiveCodes(user!.id);
  await s.authRepo.insertCode({
    userId: user!.id,
    codeHash: hashCode("1234567", creds.email),
    expiresAt: new Date(Date.now() + 60000),
  });
  await s.authService.verifyEmail({ email: creds.email, code: "1234567" });
}

test("login con email verificado devuelve sessionId y user", async () => {
  const s = await setup();
  await registerAndVerify(s);
  const out = await s.sessionService.login({ identifier: creds.email, password: creds.password });
  assert.ok(out.sessionId);
  assert.equal(out.user.nickname, "neo");
  assert.equal(out.user.is_verified, true);
});

test("login con nickname también funciona", async () => {
  const s = await setup();
  await registerAndVerify(s);
  const out = await s.sessionService.login({ identifier: "neo", password: creds.password });
  assert.ok(out.sessionId);
});

test("login con password incorrecta → 401 invalid_credentials", async () => {
  const s = await setup();
  await registerAndVerify(s);
  await assert.rejects(
    s.sessionService.login({ identifier: creds.email, password: "wrong-pass" }),
    (e: AppError) => e.statusCode === 401 && e.code === "invalid_credentials"
  );
});

test("login de usuario no verificado → 403 email_not_verified", async () => {
  const s = await setup();
  await s.authService.register(creds); // sin verificar
  await assert.rejects(
    s.sessionService.login({ identifier: creds.email, password: creds.password }),
    (e: AppError) => e.statusCode === 403 && e.code === "email_not_verified"
  );
});

test("me con sesión válida devuelve el usuario", async () => {
  const s = await setup();
  await registerAndVerify(s);
  const { sessionId } = await s.sessionService.login({ identifier: creds.email, password: creds.password });
  const user = await s.sessionService.me(sessionId);
  assert.equal(user.email, "neo@x.io");
});

test("me tras logout → 401 unauthenticated", async () => {
  const s = await setup();
  await registerAndVerify(s);
  const { sessionId } = await s.sessionService.login({ identifier: creds.email, password: creds.password });
  await s.sessionService.logout(sessionId);
  await assert.rejects(
    s.sessionService.me(sessionId),
    (e: AppError) => e.statusCode === 401 && e.code === "unauthenticated"
  );
});

test("me con sessionId no-UUID → 401 unauthenticated (sin 500)", async () => {
  const s = await setup();
  await assert.rejects(
    s.sessionService.me("garbage-not-a-uuid"),
    (e: AppError) => e.statusCode === 401 && e.code === "unauthenticated"
  );
});
