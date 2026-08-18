import type { DatabaseSync } from "node:sqlite";

export interface CommandRecord {
  id: number;
  trigger: string;
  replyText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  globalLastUsedAt: string | null;
}

export interface CreateCommandInput {
  trigger: string;
  replyText: string;
  createdBy: string;
}

interface CommandRow {
  id: number;
  trigger: string;
  reply_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  global_last_used_at: string | null;
}

function toRecord(row: CommandRow): CommandRecord {
  return {
    id: row.id,
    trigger: row.trigger,
    replyText: row.reply_text,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    globalLastUsedAt: row.global_last_used_at,
  };
}

/**
 * Data access for the `commands` and `command_user_cooldowns` tables
 * (data-model.md). Kept storage-agnostic in signature (plain objects in/out)
 * so a future non-chat management surface can reuse it directly (FR-011).
 */
export class CommandRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateCommandInput): CommandRecord {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO commands (trigger, reply_text, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.trigger, input.replyText, input.createdBy, now, now);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /** All commands, ordered by trigger — backs the public `GET /api/commands` listing. */
  list(): CommandRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM commands ORDER BY trigger COLLATE NOCASE")
      .all() as unknown as CommandRow[];
    return rows.map(toRecord);
  }

  findById(id: number): CommandRecord | null {
    const row = this.db.prepare("SELECT * FROM commands WHERE id = ?").get(id) as
      | CommandRow
      | undefined;
    return row ? toRecord(row) : null;
  }

  /** Case-insensitive lookup, matching the unique index on `LOWER(trigger)`. */
  findByTrigger(trigger: string): CommandRecord | null {
    const row = this.db
      .prepare("SELECT * FROM commands WHERE LOWER(trigger) = LOWER(?)")
      .get(trigger) as CommandRow | undefined;
    return row ? toRecord(row) : null;
  }

  updateReplyText(id: number, replyText: string): CommandRecord {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE commands SET reply_text = ?, updated_at = ? WHERE id = ?")
      .run(replyText, now, id);
    return this.findById(id)!;
  }

  /** Updates whichever of `trigger`/`replyText` is provided — used by the UI's rename-capable edit (data-model.md). */
  update(id: number, changes: { trigger?: string; replyText?: string }): CommandRecord {
    const now = new Date().toISOString();
    if (changes.trigger !== undefined) {
      this.db
        .prepare("UPDATE commands SET trigger = ?, updated_at = ? WHERE id = ?")
        .run(changes.trigger, now, id);
    }
    if (changes.replyText !== undefined) {
      this.db
        .prepare("UPDATE commands SET reply_text = ?, updated_at = ? WHERE id = ?")
        .run(changes.replyText, now, id);
    }
    return this.findById(id)!;
  }

  delete(id: number): void {
    this.db.prepare("DELETE FROM commands WHERE id = ?").run(id);
  }

  /** Marks `now` as the command's most recent non-exempt invocation (FR-009). */
  touchGlobalLastUsed(id: number, now: string): void {
    this.db.prepare("UPDATE commands SET global_last_used_at = ? WHERE id = ?").run(now, id);
  }

  /** Returns the user's last non-exempt invocation of this command, if any (FR-008). */
  getUserLastUsedAt(commandId: number, userId: string): string | null {
    const row = this.db
      .prepare(
        "SELECT last_used_at FROM command_user_cooldowns WHERE command_id = ? AND user_id = ?",
      )
      .get(commandId, userId) as { last_used_at: string } | undefined;
    return row?.last_used_at ?? null;
  }

  upsertUserLastUsed(commandId: number, userId: string, now: string): void {
    this.db
      .prepare(
        `INSERT INTO command_user_cooldowns (command_id, user_id, last_used_at)
         VALUES (?, ?, ?)
         ON CONFLICT (command_id, user_id) DO UPDATE SET last_used_at = excluded.last_used_at`,
      )
      .run(commandId, userId, now);
  }
}
