import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { checkCooldown, recordInvocation } from "./commands/cooldown.js";
import { parseMessage } from "./commands/parser.js";
import { getChatterRole } from "./commands/permissions.js";
import { SelfMessageTracker } from "./commands/selfMessage.js";
import { CommandService, type CommandActionResult } from "./commands/service.js";
import { openDatabase } from "./storage/db.js";
import { CommandRepository } from "./storage/commandRepository.js";
import { createAuthProviders } from "./twitch/auth.js";
import { createChatSender } from "./twitch/chat.js";
import { startEventSub } from "./twitch/eventsub.js";
import type { IncomingChatMessage } from "./twitch/types.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const repository = new CommandRepository(db);
  const service = new CommandService(repository);

  const auth = await createAuthProviders(config);
  const chat = createChatSender(auth, config.broadcasterUserId);
  const selfMessages = new SelfMessageTracker();
  const reply = async (text: string): Promise<void> => {
    const messageId = await chat.send(text);
    selfMessages.track(messageId);
  };

  startEventSub(auth, config.broadcasterUserId, async (message) => {
    if (selfMessages.isOwnMessage(message.messageId)) {
      return;
    }
    await handleChatMessage(message, service, repository, reply);
  });

  console.log(`Bot connected for broadcaster ${config.broadcasterUserId}.`);
}

async function handleChatMessage(
  message: IncomingChatMessage,
  service: CommandService,
  repository: CommandRepository,
  reply: (text: string) => Promise<void>,
): Promise<void> {
  const role = getChatterRole(message);
  const parsed = parseMessage(message.text);

  switch (parsed.type) {
    case "none":
      return;

    case "add": {
      const result = service.addCommand(role, message.chatterUserId, parsed.trigger, parsed.replyText);
      logger.info("Command add attempted", { trigger: parsed.trigger, by: message.chatterUserId, outcome: result.outcome });
      await replyToManagementAction(reply, "add", parsed.trigger, result);
      return;
    }

    case "edit": {
      const result = service.editCommand(role, parsed.trigger, parsed.replyText);
      logger.info("Command edit attempted", { trigger: parsed.trigger, by: message.chatterUserId, outcome: result.outcome });
      await replyToManagementAction(reply, "edit", parsed.trigger, result);
      return;
    }

    case "delete": {
      const result = service.removeCommand(role, parsed.trigger);
      logger.info("Command delete attempted", { trigger: parsed.trigger, by: message.chatterUserId, outcome: result.outcome });
      await replyToManagementAction(reply, "delete", parsed.trigger, result);
      return;
    }

    case "invocation": {
      const command = repository.findByTrigger(parsed.trigger);
      if (!command) {
        // Unknown trigger: no reply, per contracts/chat-command-syntax.md.
        return;
      }

      const now = new Date();
      const cooldown = checkCooldown(repository, command, role, message.chatterUserId, now);
      if (!cooldown.allowed) {
        logger.info("Command invocation blocked by cooldown", {
          trigger: parsed.trigger,
          by: message.chatterUserId,
          reason: cooldown.reason,
        });
        return;
      }

      recordInvocation(repository, command, role, message.chatterUserId, now);
      await reply(command.replyText);
      return;
    }
  }
}

async function replyToManagementAction(
  reply: (text: string) => Promise<void>,
  action: "add" | "edit" | "delete",
  trigger: string,
  result: CommandActionResult,
): Promise<void> {
  switch (result.outcome) {
    case "unauthorized":
      // Non-broadcaster/non-moderator: silently ignored (FR-004).
      return;
    case "added":
      await reply(`Command !${trigger} added.`);
      return;
    case "edited":
      await reply(`Command !${trigger} updated.`);
      return;
    case "removed":
      await reply(`Command !${trigger} removed.`);
      return;
    case "rejected":
      await reply(rejectionMessage(action, trigger, result.reason));
      return;
  }
}

function rejectionMessage(
  action: "add" | "edit" | "delete",
  trigger: string,
  reason: "duplicate" | "not_found" | "reserved_trigger" | "empty_trigger" | "empty_reply_text",
): string {
  switch (reason) {
    case "duplicate":
      return `Command !${trigger} already exists. Use !editcommand to change it.`;
    case "not_found":
      return `Command !${trigger} doesn't exist.`;
    case "reserved_trigger":
      return `!${trigger} is a reserved name and can't be used as a command.`;
    case "empty_trigger":
    case "empty_reply_text":
      // Unreachable via chat: parser.ts already filters blank trigger/reply
      // text before a management action reaches the service (FR-009 is
      // enforced here only for the HTTP path, which has no such pre-filter).
      return `Command !${trigger} needs both a trigger and reply text.`;
  }
  void action;
}

main().catch((error: unknown) => {
  console.error("Fatal error starting bot:", error);
  process.exitCode = 1;
});
