import { beforeEach, describe, expect, it } from "vitest";
import { checkCooldown, recordInvocation } from "../../src/commands/cooldown.js";
import { CommandService } from "../../src/commands/service.js";
import { CommandRepository } from "../../src/storage/commandRepository.js";
import { openDatabase } from "../../src/storage/db.js";

/**
 * Exercises the full command lifecycle end-to-end against a real (in-memory)
 * SQLite database: add -> invoke -> cooldown-blocked -> edit -> invoke ->
 * remove. No Twitch/Twurple client is involved in this flow (chat
 * send/receive is a thin wrapper covered separately), so there is nothing to
 * mock here.
 */
describe("command flow", () => {
  let repository: CommandRepository;
  let service: CommandService;

  beforeEach(() => {
    const db = openDatabase(":memory:");
    repository = new CommandRepository(db);
    service = new CommandService(repository);
  });

  it("supports add, invoke, cooldown block, edit, invoke, remove", () => {
    // Non-mod cannot add a command.
    const denied = service.addCommand("other", "viewer1", "discord", "https://discord.gg/example");
    expect(denied).toEqual({ outcome: "unauthorized" });
    expect(repository.findByTrigger("discord")).toBeNull();

    // Broadcaster adds it.
    const added = service.addCommand("broadcaster", "streamer", "discord", "https://discord.gg/example");
    expect(added.outcome).toBe("added");
    const command = repository.findByTrigger("discord")!;
    expect(command.replyText).toBe("https://discord.gg/example");

    // Duplicate add is rejected.
    const duplicate = service.addCommand("broadcaster", "streamer", "discord", "https://discord.gg/other");
    expect(duplicate).toEqual({ outcome: "rejected", reason: "duplicate" });

    // Viewer invokes it successfully.
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    let check = checkCooldown(repository, command, "other", "viewer1", t0);
    expect(check).toEqual({ allowed: true });
    recordInvocation(repository, command, "other", "viewer1", t0);

    // Same viewer again shortly after: blocked by the global cooldown first.
    let refreshed = repository.findByTrigger("discord")!;
    check = checkCooldown(repository, refreshed, "other", "viewer1", new Date(t0.getTime() + 1_000));
    expect(check).toEqual({ allowed: false, reason: "global" });

    // Past the global cooldown but still within their own personal cooldown.
    check = checkCooldown(repository, refreshed, "other", "viewer1", new Date(t0.getTime() + 15_000));
    expect(check).toEqual({ allowed: false, reason: "personal" });

    // Mod edits the reply.
    const edited = service.editCommand("moderator", "discord", "https://discord.gg/updated");
    expect(edited.outcome).toBe("edited");
    refreshed = repository.findByTrigger("discord")!;
    expect(refreshed.replyText).toBe("https://discord.gg/updated");

    // A different viewer, after both cooldowns elapse, gets the updated text.
    const t1 = new Date(t0.getTime() + 31_000);
    check = checkCooldown(repository, refreshed, "other", "viewer2", t1);
    expect(check).toEqual({ allowed: true });
    recordInvocation(repository, refreshed, "other", "viewer2", t1);

    // Editing/removing a non-existent command is rejected.
    expect(service.editCommand("broadcaster", "nope", "x")).toEqual({
      outcome: "rejected",
      reason: "not_found",
    });

    // Broadcaster removes the command.
    const removed = service.removeCommand("broadcaster", "discord");
    expect(removed).toEqual({ outcome: "removed", trigger: "discord" });
    expect(repository.findByTrigger("discord")).toBeNull();

    // Removing it again fails.
    expect(service.removeCommand("broadcaster", "discord")).toEqual({
      outcome: "rejected",
      reason: "not_found",
    });
  });

  it("rejects reserved trigger names", () => {
    const result = service.addCommand("broadcaster", "streamer", "addcommand", "nope");
    expect(result).toEqual({ outcome: "rejected", reason: "reserved_trigger" });
  });
});
