import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "../../config.js";
import type { AuthProviders } from "../../twitch/auth.js";
import type { CommandRecord } from "../../storage/commandRepository.js";
import { CommandRepository } from "../../storage/commandRepository.js";
import { CommandService, type CommandActionResult } from "../../commands/service.js";
import { isExempt } from "../../commands/permissions.js";
import { resolveRole } from "../role.js";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../session.js";

function toApiCommand(command: CommandRecord) {
  return {
    id: command.id,
    trigger: command.trigger,
    replyText: command.replyText,
    updatedAt: command.updatedAt,
  };
}

/**
 * Resolves the caller's role for a mutating request, live and uncached
 * (research.md §4). Returns `null` if the caller isn't signed in at all, so
 * the route can distinguish 401 (not signed in) from 403 (signed in, wrong role).
 */
async function resolveCallerRole(
  request: FastifyRequest,
  config: Config,
  auth: AuthProviders,
  resolveRoleFn: typeof resolveRole,
): Promise<import("../../commands/permissions.js").ChatterRole | null> {
  const sessionUser = await verifySessionToken(
    request.cookies[SESSION_COOKIE_NAME],
    config.sessionSecret,
  );
  if (!sessionUser) {
    return null;
  }
  return resolveRoleFn(auth, config, sessionUser.id);
}

function sendActionResult(
  reply: import("fastify").FastifyReply,
  result: CommandActionResult,
  successStatus: number,
): unknown {
  switch (result.outcome) {
    case "added":
    case "edited":
      return reply.status(successStatus).send({ command: toApiCommand(result.command) });
    case "removed":
      return reply.status(successStatus).send();
    case "unauthorized":
      // Only reached if the caller's role changed between resolveCallerRole
      // and the service call; treat as 403 since they were signed in.
      return reply.status(403).send({ error: "forbidden" });
    case "rejected":
      switch (result.reason) {
        case "not_found":
          return reply.status(404).send({ error: "not_found" });
        case "duplicate":
          return reply.status(409).send({ error: "duplicate_trigger" });
        case "reserved_trigger":
          return reply.status(400).send({ error: "reserved_trigger", field: "trigger" });
        case "empty_trigger":
          return reply.status(400).send({ error: "validation", field: "trigger" });
        case "empty_reply_text":
          return reply.status(400).send({ error: "validation", field: "replyText" });
      }
  }
}

/** Command routes per contracts/api.md, backed by the same CommandRepository/CommandService the chat path uses (FR-011). */
export function registerCommandRoutes(
  app: FastifyInstance,
  config: Config,
  auth: AuthProviders,
  repository: CommandRepository,
  resolveRoleFn: typeof resolveRole = resolveRole,
): void {
  const service = new CommandService(repository);

  app.get("/api/commands", async () => {
    return { commands: repository.list().map(toApiCommand) };
  });

  app.post<{ Body: { trigger?: string; replyText?: string } }>(
    "/api/commands",
    async (request, reply) => {
      const role = await resolveCallerRole(request, config, auth, resolveRoleFn);
      if (!role) {
        return reply.status(401).send({ error: "unauthorized" });
      }
      if (!isExempt(role)) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const { trigger, replyText } = request.body;
      const result = service.addCommand(
        role,
        // createdBy is set from the verified session user, not client input.
        (await verifySessionToken(request.cookies[SESSION_COOKIE_NAME], config.sessionSecret))!
          .id,
        trigger ?? "",
        replyText ?? "",
      );
      return sendActionResult(reply, result, 201);
    },
  );

  app.patch<{ Params: { id: string }; Body: { trigger?: string; replyText?: string } }>(
    "/api/commands/:id",
    async (request, reply) => {
      const role = await resolveCallerRole(request, config, auth, resolveRoleFn);
      if (!role) {
        return reply.status(401).send({ error: "unauthorized" });
      }
      if (!isExempt(role)) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const id = Number(request.params.id);
      const { trigger, replyText } = request.body;
      if (trigger === undefined && replyText === undefined) {
        return reply.status(400).send({ error: "validation" });
      }

      const result = service.editCommandById(role, id, { trigger, replyText });
      return sendActionResult(reply, result, 200);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/commands/:id", async (request, reply) => {
    const role = await resolveCallerRole(request, config, auth, resolveRoleFn);
    if (!role) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    if (!isExempt(role)) {
      return reply.status(403).send({ error: "forbidden" });
    }

    const id = Number(request.params.id);
    const existing = repository.findById(id);
    if (!existing) {
      return reply.status(404).send({ error: "not_found" });
    }

    const result = service.removeCommand(role, existing.trigger);
    return sendActionResult(reply, result, 204);
  });
}
