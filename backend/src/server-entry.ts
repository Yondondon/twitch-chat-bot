import { loadConfig } from "./config.js";
import { openDatabase } from "./storage/db.js";
import { CommandRepository } from "./storage/commandRepository.js";
import { createAuthProviders } from "./twitch/auth.js";
import { buildServer } from "./http/server.js";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { registerCommandRoutes } from "./http/routes/commands.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const repository = new CommandRepository(db);
  const auth = await createAuthProviders(config);

  const app = await buildServer(config);
  registerAuthRoutes(app, config, auth);
  registerCommandRoutes(app, config, auth, repository);

  await app.listen({ port: config.httpPort, host: "0.0.0.0" });
}

main().catch((error: unknown) => {
  console.error("Fatal error starting HTTP API:", error);
  process.exitCode = 1;
});
