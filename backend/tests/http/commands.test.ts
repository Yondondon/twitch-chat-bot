import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/http/server.js";
import { registerCommandRoutes } from "../../src/http/routes/commands.js";
import { CommandRepository } from "../../src/storage/commandRepository.js";
import { openDatabase } from "../../src/storage/db.js";
import { issueSessionToken, SESSION_COOKIE_NAME } from "../../src/http/session.js";
import type { Config } from "../../src/config.js";
import type { ChatterRole } from "../../src/commands/permissions.js";

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
 * Fastify test harness with a fake, injected role resolver so these tests
 * never call the real Twitch Helix API (research.md §4's live check is
 * exercised by role.ts in isolation, not here) — `roleByUserId` stands in
 * for "what Twitch would say" per test.
 */
async function buildTestServer(roleByUserId: Record<string, ChatterRole>): Promise<{
  app: FastifyInstance;
  repository: CommandRepository;
}> {
  const db = openDatabase(":memory:");
  const repository = new CommandRepository(db);
  const app = await buildServer(config);
  registerCommandRoutes(
    app,
    config,
    {} as never,
    repository,
    async (_auth, _cfg, userId) => roleByUserId[userId] ?? "other",
  );
  await app.ready();
  return { app, repository };
}

async function sessionCookie(userId: string): Promise<string> {
  const token = await issueSessionToken({ id: userId, login: `user-${userId}` }, config.sessionSecret);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("command HTTP routes", () => {
  let app: FastifyInstance;
  let repository: CommandRepository;

  describe("GET /api/commands", () => {
    beforeEach(async () => {
      ({ app, repository } = await buildTestServer({}));
    });

    it("returns the full list without requiring a session (FR-002)", async () => {
      repository.create({ trigger: "discord", replyText: "join us", createdBy: "broadcaster-1" });

      const response = await app.inject({ method: "GET", url: "/api/commands" });

      expect(response.statusCode).toBe(200);
      expect(response.json().commands).toEqual([
        expect.objectContaining({ trigger: "discord", replyText: "join us" }),
      ]);
    });
  });

  describe("POST /api/commands", () => {
    beforeEach(async () => {
      ({ app, repository } = await buildTestServer({
        "broadcaster-1": "broadcaster",
        "mod-1": "moderator",
        "viewer-1": "other",
      }));
    });

    it("rejects an anonymous caller with 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/commands",
        payload: { trigger: "discord", replyText: "join us" },
      });
      expect(response.statusCode).toBe(401);
    });

    it("rejects a signed-in non-mod caller with 403 (FR-004, FR-007)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/commands",
        headers: { cookie: await sessionCookie("viewer-1") },
        payload: { trigger: "discord", replyText: "join us" },
      });
      expect(response.statusCode).toBe(403);
    });

    it("rejects empty trigger/reply text with 400 (FR-009)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/commands",
        headers: { cookie: await sessionCookie("broadcaster-1") },
        payload: { trigger: "", replyText: "join us" },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: "validation", field: "trigger" });
    });

    it("rejects a case-insensitive duplicate trigger with 409 (FR-008)", async () => {
      repository.create({ trigger: "Discord", replyText: "existing", createdBy: "broadcaster-1" });

      const response = await app.inject({
        method: "POST",
        url: "/api/commands",
        headers: { cookie: await sessionCookie("mod-1") },
        payload: { trigger: "discord", replyText: "join us" },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "duplicate_trigger" });
    });

    it("creates a command for the broadcaster (201)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/commands",
        headers: { cookie: await sessionCookie("broadcaster-1") },
        payload: { trigger: "discord", replyText: "join us" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().command).toMatchObject({ trigger: "discord", replyText: "join us" });
      expect(repository.findByTrigger("discord")).not.toBeNull();
    });
  });

  describe("PATCH /api/commands/:id", () => {
    beforeEach(async () => {
      ({ app, repository } = await buildTestServer({ "broadcaster-1": "broadcaster" }));
    });

    it("renames a command's trigger directly (data-model.md)", async () => {
      const command = repository.create({
        trigger: "discord",
        replyText: "join us",
        createdBy: "broadcaster-1",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/commands/${command.id}`,
        headers: { cookie: await sessionCookie("broadcaster-1") },
        payload: { trigger: "server" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().command).toMatchObject({ trigger: "server", replyText: "join us" });
      expect(repository.findByTrigger("discord")).toBeNull();
      expect(repository.findByTrigger("server")).not.toBeNull();
    });

    it("returns 404 for a non-existent command", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/commands/999",
        headers: { cookie: await sessionCookie("broadcaster-1") },
        payload: { replyText: "updated" },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/commands/:id", () => {
    beforeEach(async () => {
      ({ app, repository } = await buildTestServer({
        "broadcaster-1": "broadcaster",
        "viewer-1": "other",
      }));
    });

    it("removes a command for the broadcaster (204)", async () => {
      const command = repository.create({
        trigger: "discord",
        replyText: "join us",
        createdBy: "broadcaster-1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/commands/${command.id}`,
        headers: { cookie: await sessionCookie("broadcaster-1") },
      });

      expect(response.statusCode).toBe(204);
      expect(repository.findByTrigger("discord")).toBeNull();
    });

    it("rejects a non-mod caller with 403", async () => {
      const command = repository.create({
        trigger: "discord",
        replyText: "join us",
        createdBy: "broadcaster-1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/commands/${command.id}`,
        headers: { cookie: await sessionCookie("viewer-1") },
      });

      expect(response.statusCode).toBe(403);
      expect(repository.findByTrigger("discord")).not.toBeNull();
    });
  });
});
