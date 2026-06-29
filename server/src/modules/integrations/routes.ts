import type { FastifyInstance } from "fastify";
import type { IntegrationsService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard, makeOptionalSession } from "../auth/session.guard.ts";
import { buildLoginUrl } from "./openid.ts";

const nicknameParam = {
  params: { type: "object", required: ["nickname"], properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } } },
} as const;

export async function integrationsRoutes(
  fastify: FastifyInstance,
  opts: {
    integrationsService: IntegrationsService;
    sessionService: SessionService;
    apiOrigin: string;
    webOrigin: string;
  }
): Promise<void> {
  const { integrationsService, sessionService, apiOrigin, webOrigin } = opts;
  const guard = makeSessionGuard(sessionService);
  const optional = makeOptionalSession(sessionService);

  // Inicia el login OpenID de Steam (no requiere clave de API).
  fastify.get("/integrations/steam/login", { preHandler: guard }, async (_req, reply) => {
    const returnTo = `${apiOrigin}/integrations/steam/callback`;
    return reply.redirect(buildLoginUrl(returnTo, apiOrigin));
  });

  // Callback de Steam: verifica y vincula al usuario de la sesión, luego vuelve a la web.
  fastify.get<{ Querystring: Record<string, string> }>(
    "/integrations/steam/callback",
    { preHandler: optional },
    async (req, reply) => {
      if (!req.user) return reply.redirect(`${webOrigin}/?steam=login_required`);
      try {
        await integrationsService.linkFromCallback(req.user.id, req.query);
        return reply.redirect(`${webOrigin}/?steam=linked`);
      } catch {
        return reply.redirect(`${webOrigin}/?steam=error`);
      }
    }
  );

  fastify.get("/integrations/steam/me", { preHandler: guard }, async (req) =>
    integrationsService.getMine(req.user!.id)
  );

  fastify.get("/integrations/steam/me/games", { preHandler: guard }, async (req) => ({
    games: await integrationsService.getTopGames(req.user!.id),
  }));

  fastify.delete("/integrations/steam", { preHandler: guard }, async (req) => {
    await integrationsService.unlink(req.user!.id);
    return { ok: true };
  });

  // Vista pública: solo nick de Steam + jugando ahora (no expone el SteamID64).
  fastify.get<{ Params: { nickname: string } }>(
    "/users/:nickname/steam",
    { schema: nicknameParam },
    async (req) => integrationsService.getPublic(req.params.nickname)
  );
}
