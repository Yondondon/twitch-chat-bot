import { beforeEach, describe, expect, it } from "vitest";
import { checkCooldown, recordInvocation } from "../../src/commands/cooldown.js";
import { CommandRepository } from "../../src/storage/commandRepository.js";
import { openDatabase } from "../../src/storage/db.js";

describe("cooldown", () => {
  let repository: CommandRepository;

  beforeEach(() => {
    const db = openDatabase(":memory:");
    repository = new CommandRepository(db);
  });

  it("allows the first invocation by a regular viewer", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    const result = checkCooldown(repository, command, "other", "viewer1", new Date());
    expect(result).toEqual({ allowed: true });
  });

  it("blocks a second invocation by the same viewer within the personal cooldown", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    recordInvocation(repository, command, "other", "viewer1", t0);

    // Past the 10s global cooldown but still inside the 30s personal one, to
    // isolate the personal-cooldown check from the global one.
    const t1 = new Date(t0.getTime() + 15_000);
    const refreshed = repository.findById(command.id)!;
    const result = checkCooldown(repository, refreshed, "other", "viewer1", t1);
    expect(result).toEqual({ allowed: false, reason: "personal" });
  });

  it("blocks a different viewer within the global cooldown", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    recordInvocation(repository, command, "other", "viewer1", t0);

    const t1 = new Date(t0.getTime() + 5_000);
    const refreshed = repository.findById(command.id)!;
    const result = checkCooldown(repository, refreshed, "other", "viewer2", t1);
    expect(result).toEqual({ allowed: false, reason: "global" });
  });

  it("allows a different viewer once the global cooldown has elapsed", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    recordInvocation(repository, command, "other", "viewer1", t0);

    const t1 = new Date(t0.getTime() + 11_000);
    const refreshed = repository.findById(command.id)!;
    const result = checkCooldown(repository, refreshed, "other", "viewer2", t1);
    expect(result).toEqual({ allowed: true });
  });

  it("never blocks broadcaster or moderator regardless of recent use", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    recordInvocation(repository, command, "other", "viewer1", t0);

    const refreshed = repository.findById(command.id)!;
    expect(checkCooldown(repository, refreshed, "broadcaster", "streamer", t0)).toEqual({ allowed: true });
    expect(checkCooldown(repository, refreshed, "moderator", "mod1", t0)).toEqual({ allowed: true });
  });

  it("does not write cooldown state for exempt roles", () => {
    const command = repository.create({ trigger: "ping", replyText: "pong", createdBy: "mod1" });
    recordInvocation(repository, command, "moderator", "mod1", new Date());

    const refreshed = repository.findById(command.id)!;
    expect(refreshed.globalLastUsedAt).toBeNull();
    expect(repository.getUserLastUsedAt(command.id, "mod1")).toBeNull();
  });
});
