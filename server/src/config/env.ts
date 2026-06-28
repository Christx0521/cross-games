import { existsSync } from "node:fs";
import { z } from "zod";

// Carga el .env local en dev/test si existe; en producción las variables
// llegan por el entorno real. No pisa variables ya definidas.
try {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch {
  // sin .env: se usan las variables del entorno
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_PATH: z.string().min(1).default("./.pgdata"),
  CODE_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().min(1).default("Cross-Games <onboarding@resend.dev>"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return schema.parse(source);
}

export const env = loadEnv();
