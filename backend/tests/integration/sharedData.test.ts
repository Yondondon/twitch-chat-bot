import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/http/server.js";
import { registerCommandRoutes } from "../../src/http/routes/commands.js";
import { CommandService } from "../../src/commands/service.js";
import { CommandRepository } from "../../src/storage/commandRepository.js";
import { openDatabase } from "../../src/storage/db.js";
import type { Config } from "../../src/config.js";

const config: Config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  broadcasterUserId: "broadcaster-1",
  broadcasterAccessToken: "token",
  broadcasterRefreshToken: "refresh",
  databasePath: ":memory:",
  twitchRedirectUri: "http://localhost:8787/api/auth/callback",
  sessionSecret: "test-secret",
  uiOrigin: "http://localhost:5173",
  httpPort: 8787,
};

/**
 * Proves FR-011: the chat path (CommandService called directly, as
 * backend/src/index.ts does) and the HTTP path (registerCommandRoutes) read
 * and write the exact same underlying data via a shared CommandRepository —
 * there is no separate sync step (spec.md US3).
 */
describe("chat and HTTP paths share the same command data", () => {
  async function buildTestServer(repository: CommandRepository): Promise<FastifyInstance> {
    const app = await buildServer(config);
    registerCommandRoutes(app, config, {} as never, repository, async () => "broadcaster");
    await app.ready();
    return app;
  }

  it("reflects a chat-path add/edit/delete through the HTTP GET listing", async () => {
    const db = openDatabase(":memory:");
    const repository = new CommandRepository(db);
    const chatService = new CommandService(repository);
    const app = await buildTestServer(repository);

    // Added via chat (as backend/src/index.ts's "add" case does).
    chatService.addCommand("broadcaster", "streamer", "discord", "join us");

    let response = await app.inject({ method: "GET", url: "/api/commands" });
    expect(response.json().commands).toEqual([
      expect.objectContaining({ trigger: "discord", replyText: "join us" }),
    ]);

    // Edited via chat.
    chatService.editCommand("broadcaster", "discord", "join us now");
    response = await app.inject({ method: "GET", url: "/api/commands" });
    expect(response.json().commands[0]).toMatchObject({ replyText: "join us now" });

    // Removed via chat.
    chatService.removeCommand("broadcaster", "discord");
    response = await app.inject({ method: "GET", url: "/api/commands" });
    expect(response.json().commands).toEqual([]);
  });

  it("reflects an HTTP-path add through the chat-side repository lookup", async () => {
    const db = openDatabase(":memory:");
    const repository = new CommandRepository(db);
    const app = await buildTestServer(repository);

    const response = await app.inject({
      method: "POST",
      url: "/api/commands",
      headers: {
        cookie: `session=${await (
          await import("../../src/http/session.js")
        ).issueSessionToken({ id: "broadcaster-1", login: "streamer" }, config.sessionSecret)}`,
      },
      payload: { trigger: "discord", replyText: "join us" },
    });
    expect(response.statusCode).toBe(201);

    // Looked up exactly as backend/src/index.ts does for a chat invocation.
    expect(repository.findByTrigger("discord")).toMatchObject({ replyText: "join us" });
  });
});
