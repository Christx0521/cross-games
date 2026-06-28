import type { FastifyInstance } from "fastify";
import type { FriendsService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const requestSchema = {
  body: {
    type: "object",
    required: ["nickname"],
    additionalProperties: false,
    properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } },
  },
} as const;

const idParam = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
} as const;

export async function friendsRoutes(
  fastify: FastifyInstance,
  opts: { friendsService: FriendsService; sessionService: SessionService }
): Promise<void> {
  const { friendsService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.post<{ Body: { nickname: string } }>(
    "/friends/request",
    { preHandler: guard, schema: requestSchema },
    async (req) =>
      friendsService.requestFriend(
        { id: req.user!.id, nickname: req.user!.nickname },
        req.body.nickname
      )
  );

  fastify.post<{ Params: { id: string } }>(
    "/friends/:id/accept",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await friendsService.accept(req.user!.id, req.params.id);
      return { ok: true };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/friends/:id/reject",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await friendsService.reject(req.user!.id, req.params.id);
      return { ok: true };
    }
  );

  fastify.get("/friends", { preHandler: guard }, async (req) =>
    friendsService.listFriends(req.user!.id)
  );

  fastify.get("/friends/requests", { preHandler: guard }, async (req) =>
    friendsService.listRequests(req.user!.id)
  );
}
