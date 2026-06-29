import type { FastifyInstance } from "fastify";
import type { SearchRepo, ForumHit, UserHit } from "./repo.ts";

const searchSchema = {
  querystring: {
    type: "object",
    required: ["q"],
    additionalProperties: false,
    properties: { q: { type: "string", minLength: 1, maxLength: 64 } },
  },
} as const;

export async function searchRoutes(
  fastify: FastifyInstance,
  opts: { searchRepo: SearchRepo }
): Promise<void> {
  const { searchRepo } = opts;

  // Búsqueda global (pública): foros por nombre y usuarios por nickname.
  fastify.get<{ Querystring: { q: string } }>(
    "/search",
    { schema: searchSchema },
    async (req): Promise<{ forums: ForumHit[]; users: UserHit[] }> => {
      const q = req.query.q.trim();
      if (!q) return { forums: [], users: [] };
      const [forums, users] = await Promise.all([searchRepo.searchForums(q), searchRepo.searchUsers(q)]);
      return { forums, users };
    }
  );
}
