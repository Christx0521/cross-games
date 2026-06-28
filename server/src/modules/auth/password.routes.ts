import type { FastifyInstance } from "fastify";
import type { PasswordService } from "./password.service.ts";

const forgotSchema = {
  body: {
    type: "object",
    required: ["email"],
    additionalProperties: false,
    properties: { email: { type: "string", format: "email" } },
  },
} as const;

const resetSchema = {
  body: {
    type: "object",
    required: ["email", "code", "newPassword"],
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email" },
      code: { type: "string", pattern: "^\\d{7}$" },
      newPassword: { type: "string", minLength: 8, maxLength: 200 },
    },
  },
} as const;

export async function passwordRoutes(
  fastify: FastifyInstance,
  opts: { passwordService: PasswordService }
): Promise<void> {
  const { passwordService } = opts;

  fastify.post<{ Body: { email: string } }>(
    "/auth/forgot-password",
    { schema: forgotSchema },
    async (req) => {
      await passwordService.forgotPassword(req.body.email);
      return { sent: true };
    }
  );

  fastify.post<{ Body: { email: string; code: string; newPassword: string } }>(
    "/auth/reset-password",
    { schema: resetSchema },
    async (req) => passwordService.resetPassword(req.body)
  );
}
