import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "./repo.ts";
import { createSessionRepo } from "./session.repo.ts";
import { createAuthService } from "./service.ts";
import { createSessionService } from "./session.service.ts";
import { createPasswordService } from "./password.service.ts";
import { hashCode } from "../../lib/code.ts";
import { verifyPassword } from "../../lib/password.ts";
import { AppError } from "../../lib/errors.ts";

const creds = { nickname: "neo", email: "neo@x.io", password: "S3cret!1", birthYear: 1990 };

async function setup() {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const sessionRepo = createSessionRepo(db);
  const authService = createAuthService({ repo: authRepo });
  const sessionService = createSessionService({ authRepo, sessionRepo });
  const passwordService = createPasswordService({ authRepo, sessionRepo });
  return { db, authRepo, sessionRepo, authService, sessionService, passwordService };
}

async function registerAndVerify(s: Awaited<ReturnType<typeof setup>>) {
  await s.authService.register(creds);
  return (await s.authRepo.findUserByEmail(creds.email))!;
}

// Inserta un código de reset conocido y devuelve su texto.
async function seedResetCode(s: Awaited<ReturnType<typeof setup>>, userId: string) {
  await s.authRepo.invalidateActiveCodes(userId, "password_reset");
  await s.authRepo.insertCode({
    userId,
    codeHash: hashCode("7777777", creds.email),
    expiresAt: new Date(Date.now() + 60000),
    purpose: "password_reset",
  });
  return "7777777";
}

test("forgotPassword no lanza para email inexistente", async () => {
  const s = await setup();
  await s.passwordService.forgotPassword("ghost@x.io");
});

test("resetPassword cambia la contraseña con código válido", async () => {
  const s = await setup();
  const user = await registerAndVerify(s);
  const code = await seedResetCode(s, user.id);
  const out = await s.passwordService.resetPassword({
    email: creds.email, code, newPassword: "NewP4ss!9",
  });
  assert.deepEqual(out, { reset: true });
  const updated = await s.authRepo.findUserByEmail(creds.email);
  assert.equal(await verifyPassword(updated!.password_hash, "NewP4ss!9"), true);
  assert.equal(await verifyPassword(updated!.password_hash, creds.password), false);
});

test("resetPassword invalida las sesiones existentes", async () => {
  const s = await setup();
  const user = await registerAndVerify(s);
  const { sessionId } = await s.sessionService.login({ identifier: creds.email, password: creds.password });
  const code = await seedResetCode(s, user.id);
  await s.passwordService.resetPassword({ email: creds.email, code, newPassword: "NewP4ss!9" });
  await assert.rejects(
    s.sessionService.me(sessionId),
    (e: AppError) => e.statusCode === 401
  );
});

test("resetPassword con código incorrecto → 400 invalid_code", async () => {
  const s = await setup();
  const user = await registerAndVerify(s);
  await seedResetCode(s, user.id);
  await assert.rejects(
    s.passwordService.resetPassword({ email: creds.email, code: "0000000", newPassword: "NewP4ss!9" }),
    (e: AppError) => e.statusCode === 400 && e.code === "invalid_code"
  );
});

test("resetPassword sin código activo → 410 code_expired", async () => {
  const s = await setup();
  await registerAndVerify(s);
  await assert.rejects(
    s.passwordService.resetPassword({ email: creds.email, code: "7777777", newPassword: "NewP4ss!9" }),
    (e: AppError) => e.statusCode === 410 && e.code === "code_expired"
  );
});

test("resetPassword email inexistente → 400 invalid_code (anti-enumeración)", async () => {
  const s = await setup();
  await assert.rejects(
    s.passwordService.resetPassword({ email: "ghost@x.io", code: "7777777", newPassword: "NewP4ss!9" }),
    (e: AppError) => e.statusCode === 400 && e.code === "invalid_code"
  );
});
