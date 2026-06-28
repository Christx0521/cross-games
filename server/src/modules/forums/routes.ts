import type { FastifyInstance } from "fastify";
import type { ForumsService } from "./service.ts";
import type { ChatService } from "../chat/service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const listSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      country: { type: "string", minLength: 2, maxLength: 2 },
      language: { type: "string", minLength: 2, maxLength: 2 },
      continent: { type: "string", minLength: 2, maxLength: 2 },
    },
  },
} as const;

const createSchema = {
  body: {
    type: "object",
    required: ["name", "languageCode", "continent"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      languageCode: { type: "string", minLength: 2, maxLength: 2 },
      continent: { type: "string", minLength: 2, maxLength: 2 },
      countryCode: { type: ["string", "null"], minLength: 2, maxLength: 2 },
    },
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

export async function forumsRoutes(
  fastify: FastifyInstance,
  opts: { forumsService: ForumsService; chatService: ChatService; sessionService: SessionService }
): Promise<void> {
  const { forumsService, chatService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  // Listado y lectura: públicos (sin guard).
  fastify.get<{ Querystring: { country?: string; language?: string; continent?: string } }>(
    "/forums",
    { schema: listSchema },
    async (req) => forumsService.listForums(req.query)
  );

  fastify.get<{ Params: { id: string } }>("/forums/:id", async (req) =>
    forumsService.getForum(req.params.id)
  );

  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: number } }>(
    "/forums/:id/messages",
    { schema: messagesSchema },
    async (req) => {
      const forum = await forumsService.getForum(req.params.id);
      return chatService.getForumHistory(forum.conversation_id, req.query.before, req.query.limit);
    }
  );

  // Crear foro: requiere sesión verificada.
  fastify.post<{
    Body: { name: string; languageCode: string; continent: string; countryCode?: string | null };
  }>("/forums", { preHandler: guard, schema: createSchema }, async (req, reply) => {
    const forum = await forumsService.createForum(req.body);
    return reply.code(201).send(forum);
  });
}
