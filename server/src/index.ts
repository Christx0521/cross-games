import { env } from "./config/env.ts";
import { db } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { buildApp } from "./app.ts";

async function main(): Promise<void> {
  await runMigrations(db);
  const app = await buildApp({ db });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`[server] escuchando en http://localhost:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
