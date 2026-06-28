import type { FastifyInstance } from "fastify";
import type { ChatService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const dmSchema = {
  body: {
    type: "object",
    required: ["nickname"],
    additionalProperties: false,
    properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } },
  },
} as const;

const messagesSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      before: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
} as const;

export async function chatRoutes(
  fastify: FastifyInstance,
  opts: { chatService: ChatService; sessionService: SessionService }
): Promise<void> {
  const { chatService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.post<{ Body: { nickname: string } }>(
    "/conversations/dm",
    { preHandler: guard, schema: dmSchema },
    async (req) => chatService.getOrCreateDm(req.user!.id, req.body.nickname)
  );

  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: number } }>(
    "/conversations/:id/messages",
    { preHandler: guard, schema: messagesSchema },
    async (req) =>
      chatService.getHistory(req.user!.id, req.params.id, req.query.before, req.query.limit)
  );
}
