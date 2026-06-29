import type { FastifyInstance } from "fastify";
import type { ThreadsService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard, makeOptionalSession } from "../auth/session.guard.ts";

const sortEnum = ["hot", "new", "top"] as const;

const listSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: { sort: { type: "string", enum: sortEnum } },
  },
} as const;

const createThreadSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
  body: {
    type: "object",
    required: ["title"],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", maxLength: 8000 },
      attachmentUrl: { type: ["string", "null"] },
    },
  },
} as const;

const idParam = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
} as const;

const voteSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
  body: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: { type: "integer", minimum: -1, maximum: 1 } },
  },
} as const;

const commentSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
  body: {
    type: "object",
    required: ["body"],
    additionalProperties: false,
    properties: {
      body: { type: "string", minLength: 1, maxLength: 4000 },
      parentId: { type: ["string", "null"], format: "uuid" },
    },
  },
} as const;

export async function threadsRoutes(
  fastify: FastifyInstance,
  opts: { threadsService: ThreadsService; sessionService: SessionService }
): Promise<void> {
  const { threadsService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);
  const optional = makeOptionalSession(sessionService);

  // Listado de hilos de un foro (público, personaliza voto si hay sesión).
  fastify.get<{ Params: { id: string }; Querystring: { sort?: (typeof sortEnum)[number] } }>(
    "/forums/:id/threads",
    { preHandler: optional, schema: listSchema },
    async (req) => threadsService.listThreads(req.params.id, req.query.sort, req.user?.id ?? null)
  );

  // Crear hilo (requiere sesión).
  fastify.post<{ Params: { id: string }; Body: { title: string; body?: string; attachmentUrl?: string | null } }>(
    "/forums/:id/threads",
    { preHandler: guard, schema: createThreadSchema },
    async (req, reply) => {
      const thread = await threadsService.createThread(req.params.id, req.user!.id, req.body);
      return reply.code(201).send(thread);
    }
  );

  // Detalle de un hilo (público).
  fastify.get<{ Params: { id: string } }>(
    "/threads/:id",
    { preHandler: optional, schema: idParam },
    async (req) => threadsService.getThread(req.params.id, req.user?.id ?? null)
  );

  // Comentarios de un hilo (público).
  fastify.get<{ Params: { id: string } }>(
    "/threads/:id/comments",
    { preHandler: optional, schema: idParam },
    async (req) => threadsService.listComments(req.params.id, req.user?.id ?? null)
  );

  // Comentar un hilo (requiere sesión).
  fastify.post<{ Params: { id: string }; Body: { body: string; parentId?: string | null } }>(
    "/threads/:id/comments",
    { preHandler: guard, schema: commentSchema },
    async (req, reply) => {
      const comment = await threadsService.addComment(req.params.id, req.user!.id, req.body);
      return reply.code(201).send(comment);
    }
  );

  // Votar un hilo (requiere sesión). value: 1 (up), -1 (down), 0 (quitar).
  fastify.post<{ Params: { id: string }; Body: { value: number } }>(
    "/threads/:id/vote",
    { preHandler: guard, schema: voteSchema },
    async (req) => threadsService.voteThread(req.params.id, req.user!.id, req.body.value)
  );

  // Votar un comentario (requiere sesión).
  fastify.post<{ Params: { id: string }; Body: { value: number } }>(
    "/comments/:id/vote",
    { preHandler: guard, schema: voteSchema },
    async (req) => threadsService.voteComment(req.params.id, req.user!.id, req.body.value)
  );
}
