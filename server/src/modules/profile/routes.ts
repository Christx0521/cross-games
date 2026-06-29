import type { FastifyInstance } from "fastify";
import type { ProfileService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";
import { AppError } from "../../lib/errors.ts";

const updateSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      description: { type: ["string", "null"], maxLength: 280 },
      countryCode: { type: ["string", "null"], minLength: 2, maxLength: 2 },
      languages: {
        type: "array",
        maxItems: 10,
        items: { type: "string", minLength: 2, maxLength: 2 },
      },
      games: {
        type: "array",
        maxItems: 12,
        items: { type: "string", minLength: 1, maxLength: 60 },
      },
    },
  },
} as const;

export async function profileRoutes(
  fastify: FastifyInstance,
  opts: { profileService: ProfileService; sessionService: SessionService }
): Promise<void> {
  const { profileService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.get<{ Params: { nickname: string } }>(
    "/users/:nickname",
    async (req) => profileService.getPublicProfile(req.params.nickname)
  );

  fastify.patch<{
    Body: { description?: string | null; countryCode?: string | null; languages?: string[]; games?: string[] };
  }>("/me/profile", { preHandler: guard, schema: updateSchema }, async (req) => {
    await profileService.updateProfile(req.user!.id, req.body);
    return profileService.getPublicProfile(req.user!.nickname);
  });

  fastify.post("/me/avatar", { preHandler: guard }, async (req) => {
    const file = await req.file();
    if (!file) throw new AppError(400, "no_file");
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new AppError(413, "file_too_large");
    return profileService.setAvatar(req.user!.id, buf, file.mimetype);
  });

  fastify.post("/me/banner", { preHandler: guard }, async (req) => {
    const file = await req.file();
    if (!file) throw new AppError(400, "no_file");
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new AppError(413, "file_too_large");
    return profileService.setBanner(req.user!.id, buf, file.mimetype);
  });
}
