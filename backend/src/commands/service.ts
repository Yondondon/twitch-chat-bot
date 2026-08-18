import type { CommandRecord, CommandRepository } from "../storage/commandRepository.js";
import { isReservedTrigger } from "./parser.js";
import { isExempt, type ChatterRole } from "./permissions.js";

export type CommandActionResult =
  | { outcome: "added"; command: CommandRecord }
  | { outcome: "edited"; command: CommandRecord }
  | { outcome: "removed"; trigger: string }
  | {
      outcome: "rejected";
      reason: "duplicate" | "not_found" | "reserved_trigger" | "empty_trigger" | "empty_reply_text";
    }
  | { outcome: "unauthorized" };

/**
 * Orchestrates command add/edit/remove (FR-001–FR-005), enforcing that only
 * the broadcaster/moderators may write (FR-004) and that reserved
 * management keywords and duplicate triggers are rejected.
 */
export class CommandService {
  constructor(private readonly repository: CommandRepository) {}

  addCommand(role: ChatterRole, createdBy: string, trigger: string, replyText: string): CommandActionResult {
    if (!isExempt(role)) {
      return { outcome: "unauthorized" };
    }
    if (!trigger.trim()) {
      return { outcome: "rejected", reason: "empty_trigger" };
    }
    if (!replyText.trim()) {
      return { outcome: "rejected", reason: "empty_reply_text" };
    }
    if (isReservedTrigger(trigger)) {
      return { outcome: "rejected", reason: "reserved_trigger" };
    }
    if (this.repository.findByTrigger(trigger)) {
      return { outcome: "rejected", reason: "duplicate" };
    }

    const command = this.repository.create({ trigger, replyText, createdBy });
    return { outcome: "added", command };
  }

  editCommand(role: ChatterRole, trigger: string, replyText: string): CommandActionResult {
    if (!isExempt(role)) {
      return { outcome: "unauthorized" };
    }

    const existing = this.repository.findByTrigger(trigger);
    if (!existing) {
      return { outcome: "rejected", reason: "not_found" };
    }

    const command = this.repository.updateReplyText(existing.id, replyText);
    return { outcome: "edited", command };
  }

  removeCommand(role: ChatterRole, trigger: string): CommandActionResult {
    if (!isExempt(role)) {
      return { outcome: "unauthorized" };
    }

    const existing = this.repository.findByTrigger(trigger);
    if (!existing) {
      return { outcome: "rejected", reason: "not_found" };
    }

    this.repository.delete(existing.id);
    return { outcome: "removed", trigger: existing.trigger };
  }

  /**
   * UI-only edit path, keyed by id rather than trigger (contracts/api.md's
   * PATCH /api/commands/:id): unlike chat's `editCommand`, this allows
   * renaming the trigger directly in one action (data-model.md,
   * research.md §5). `changes` fields are only applied when provided.
   */
  editCommandById(
    role: ChatterRole,
    id: number,
    changes: { trigger?: string; replyText?: string },
  ): CommandActionResult {
    if (!isExempt(role)) {
      return { outcome: "unauthorized" };
    }

    const existing = this.repository.findById(id);
    if (!existing) {
      return { outcome: "rejected", reason: "not_found" };
    }

    if (changes.trigger !== undefined) {
      if (!changes.trigger.trim()) {
        return { outcome: "rejected", reason: "empty_trigger" };
      }
      if (isReservedTrigger(changes.trigger)) {
        return { outcome: "rejected", reason: "reserved_trigger" };
      }
      const collision = this.repository.findByTrigger(changes.trigger);
      if (collision && collision.id !== existing.id) {
        return { outcome: "rejected", reason: "duplicate" };
      }
    }

    if (changes.replyText !== undefined && !changes.replyText.trim()) {
      return { outcome: "rejected", reason: "empty_reply_text" };
    }

    const command = this.repository.update(id, changes);
    return { outcome: "edited", command };
  }
}
