import type { FastifyInstance } from "fastify";
import type { AuthService } from "./service.ts";

const registerSchema = {
  body: {
    type: "object",
    required: ["nickname", "email", "password", "birthYear"],
    additionalProperties: false,
    properties: {
      nickname: { type: "string", minLength: 3, maxLength: 32 },
      email: { type: "string", format: "email", maxLength: 255 },
      password: { type: "string", minLength: 8, maxLength: 200 },
      birthYear: { type: "integer", minimum: 1900, maximum: 2100 },
    },
  },
} as const;

export async function authRoutes(
  fastify: FastifyInstance,
  opts: { service: AuthService }
): Promise<void> {
  const { service } = opts;

  fastify.post<{ Body: { nickname: string; email: string; password: string; birthYear: number } }>(
    "/auth/register",
    { schema: registerSchema },
    async (req, reply) => {
      const out = await service.register(req.body);
      return reply.code(201).send(out);
    }
  );
}
