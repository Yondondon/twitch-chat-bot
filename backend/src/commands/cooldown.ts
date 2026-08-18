import type { CommandRecord, CommandRepository } from "../storage/commandRepository.js";
import { isExempt, type ChatterRole } from "./permissions.js";

/** Fixed, system-wide cooldowns (FR-010) — not configurable per command. */
export const GLOBAL_COOLDOWN_MS = 10_000;
export const PERSONAL_COOLDOWN_MS = 30_000;

export type CooldownCheck =
  | { allowed: true }
  | { allowed: false; reason: "global" | "personal" };

/**
 * Evaluates whether `role`/`userId` may invoke `command` right now.
 * Broadcaster/moderators are always allowed (FR-007). For everyone else,
 * both the global (FR-009) and personal (FR-008) cooldowns must have
 * elapsed.
 */
export function checkCooldown(
  repository: CommandRepository,
  command: CommandRecord,
  role: ChatterRole,
  userId: string,
  now: Date,
): CooldownCheck {
  if (isExempt(role)) {
    return { allowed: true };
  }

  if (command.globalLastUsedAt && elapsedMs(command.globalLastUsedAt, now) < GLOBAL_COOLDOWN_MS) {
    return { allowed: false, reason: "global" };
  }

  const userLastUsedAt = repository.getUserLastUsedAt(command.id, userId);
  if (userLastUsedAt && elapsedMs(userLastUsedAt, now) < PERSONAL_COOLDOWN_MS) {
    return { allowed: false, reason: "personal" };
  }

  return { allowed: true };
}

/** Records `now` as the latest invocation for cooldown purposes. No-op for exempt roles. */
export function recordInvocation(
  repository: CommandRepository,
  command: CommandRecord,
  role: ChatterRole,
  userId: string,
  now: Date,
): void {
  if (isExempt(role)) {
    return;
  }
  const iso = now.toISOString();
  repository.touchGlobalLastUsed(command.id, iso);
  repository.upsertUserLastUsed(command.id, userId, iso);
}

function elapsedMs(isoTimestamp: string, now: Date): number {
  return now.getTime() - new Date(isoTimestamp).getTime();
}
