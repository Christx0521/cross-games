import type { FastifyInstance } from "fastify";
import type { StoriesService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";
import { type Storage, extForMime } from "../../lib/storage.ts";
import { AppError } from "../../lib/errors.ts";

const idParam = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
} as const;

export async function storiesRoutes(
  fastify: FastifyInstance,
  opts: { storiesService: StoriesService; sessionService: SessionService; storage: Storage }
): Promise<void> {
  const { storiesService, sessionService, storage } = opts;
  const guard = makeSessionGuard(sessionService);

  // Stories activas (propias + amigos).
  fastify.get("/stories", { preHandler: guard }, async (req) => storiesService.getActive(req.user!.id));

  // Crear story (imagen obligatoria; caption opcional en el campo "caption").
  fastify.post("/stories", { preHandler: guard }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw new AppError(400, "no_file");
    const ext = extForMime(file.mimetype);
    if (!ext) throw new AppError(415, "unsupported_media_type");
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new AppError(413, "file_too_large");
    const caption =
      typeof file.fields.caption === "object" && file.fields.caption && "value" in file.fields.caption
        ? String((file.fields.caption as { value: unknown }).value ?? "")
        : "";
    const url = await storage.save(buf, ext);
    const r = await storiesService.createStory(req.user!.id, url, caption);
    return reply.code(201).send(r);
  });

  fastify.post<{ Params: { id: string } }>(
    "/stories/:id/view",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await storiesService.view(req.params.id, req.user!.id);
      return { ok: true };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/stories/:id",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await storiesService.deleteStory(req.params.id, req.user!.id);
      return { ok: true };
    }
  );
}
