import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../../db/migrate.ts";
import { createAuthRepo } from "../auth/repo.ts";
import { createIntegrationsRepo } from "./repo.ts";
import { createIntegrationsService } from "./service.ts";
import { createDisabledSteamClient, type SteamClient, type SteamSummary } from "../../lib/steam.ts";
import { buildLoginUrl, extractSteamId, verifyCallback } from "./openid.ts";
import { AppError } from "../../lib/errors.ts";

const STEAMID = "76561198000000000";

// Verificador OpenID falso: válido salvo que se pida lo contrario.
const okVerify = async () => "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n";
const badVerify = async () => "ns:http://specs.openid.net/auth/2.0\nis_valid:false\n";

function callbackQuery(): Record<string, string> {
  return {
    "openid.mode": "id_res",
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAMID}`,
    "openid.sig": "abc",
  };
}

async function setup(client: SteamClient = createDisabledSteamClient()) {
  const db = new PGlite();
  await runMigrations(db);
  const authRepo = createAuthRepo(db);
  const repo = createIntegrationsRepo(db);
  const service = createIntegrationsService({ repo, client });
  const user = await authRepo.createUser({ nickname: "neo", email: "neo@x.io", passwordHash: "h", birthYear: 1990 });
  return { db, service, user };
}

test("openid: buildLoginUrl incluye los parámetros obligatorios", () => {
  const url = buildLoginUrl("http://localhost:3000/integrations/steam/callback", "http://localhost:3000");
  assert.ok(url.startsWith("https://steamcommunity.com/openid/login?"));
  assert.ok(url.includes("openid.mode=checkid_setup"));
  assert.ok(url.includes("identifier_select"));
});

test("openid: extractSteamId valida el formato del claimed_id", () => {
  assert.equal(extractSteamId(`https://steamcommunity.com/openid/id/${STEAMID}`), STEAMID);
  assert.equal(extractSteamId("https://evil.com/openid/id/123"), null);
  assert.equal(extractSteamId(undefined), null);
});

test("openid: verifyCallback devuelve el steamid solo si Steam responde is_valid:true", async () => {
  assert.equal(await verifyCallback(callbackQuery(), okVerify), STEAMID);
  assert.equal(await verifyCallback(callbackQuery(), badVerify), null);
});

test("sin clave: vincular funciona y getMine reporta enabled:false sin actividad", async () => {
  const s = await setup();
  const r = await s.service.linkFromCallback(s.user.id, callbackQuery(), okVerify);
  assert.equal(r.steamid64, STEAMID);

  const mine = await s.service.getMine(s.user.id);
  assert.equal(mine.linked, true);
  assert.equal(mine.enabled, false);
  assert.equal(mine.steamid64, STEAMID);
  assert.equal(mine.now_playing, null);
});

test("verificación inválida → 400 y no se vincula", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.linkFromCallback(s.user.id, callbackQuery(), badVerify),
    (e: AppError) => e.statusCode === 400 && e.code === "steam_verification_failed"
  );
  assert.equal((await s.service.getMine(s.user.id)).linked, false);
});

test("con cliente habilitado: ensureFresh trae persona y 'jugando ahora'", async () => {
  const summary: SteamSummary = {
    steamid: STEAMID,
    persona_name: "NeoGamer",
    avatar: "http://img/neo.jpg",
    profile_public: true,
    game_id: "730",
    game_name: "Counter-Strike 2",
  };
  const client: SteamClient = {
    enabled: true,
    async getPlayerSummaries() {
      return new Map([[STEAMID, summary]]);
    },
    async getOwnedGames() {
      return [{ appid: 730, name: "Counter-Strike 2", playtime_minutes: 1200 }];
    },
  };
  const s = await setup(client);
  await s.service.linkFromCallback(s.user.id, callbackQuery(), okVerify);

  const mine = await s.service.getMine(s.user.id);
  assert.equal(mine.enabled, true);
  assert.equal(mine.persona_name, "NeoGamer");
  assert.equal(mine.now_playing, "Counter-Strike 2");

  const pub = await s.service.getPublic("neo");
  assert.equal(pub.linked, true);
  assert.equal(pub.profile_public, true);
  assert.equal(pub.now_playing, "Counter-Strike 2");

  const games = await s.service.getTopGames(s.user.id);
  assert.equal(games[0]!.name, "Counter-Strike 2");
});

test("unlink desvincula la cuenta", async () => {
  const s = await setup();
  await s.service.linkFromCallback(s.user.id, callbackQuery(), okVerify);
  await s.service.unlink(s.user.id);
  assert.equal((await s.service.getMine(s.user.id)).linked, false);
});

test("getPublic de nickname inexistente → 404", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.getPublic("ghost"),
    (e: AppError) => e.statusCode === 404 && e.code === "user_not_found"
  );
});
